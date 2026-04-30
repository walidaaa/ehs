import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Helper to build WHERE clause
const buildWhereClause = (filters: Record<string, any>, startIndex = 1) => {
  const conditions: string[] = [];
  const values: any[] = [];
  let index = startIndex;

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      conditions.push(`${key} = $${index}`);
      values.push(value);
      index++;
    }
  });

  return { conditions, values };
};

// Helper to add role-based access control filters
const addAccessControlFilter = async (
  tableName: string, 
  userRole: string | null, 
  userId: string, 
  conditions: string[], 
  values: any[]
) => {
  let index = values.length + 1;

  // For admins (role 'admin'), filter to their service scope
  if (userRole === 'admin') {
    switch (tableName) {
      case 'profiles':
        // Admin sees profiles they created
        conditions.push(`created_by = $${index}`);
        values.push(userId);
        break;
      case 'appointments':
        // Admin sees appointments for doctors they created
        conditions.push(`doctor_id IN (SELECT id FROM profiles WHERE created_by = $${index})`);
        values.push(userId);
        break;
      case 'patient_tasks':
        // Admin sees tasks for doctors they created
        conditions.push(`doctor_id IN (SELECT id FROM profiles WHERE created_by = $${index})`);
        values.push(userId);
        break;
      case 'treatments':
        // Admin sees treatments for their doctors' patients
        conditions.push(`patient_id IN (SELECT id FROM patients WHERE doctor_id IN (SELECT id FROM profiles WHERE created_by = $${index}))`);
        values.push(userId);
        break;
      case 'attendance':
        // Admin sees attendance for their doctors' patients
        conditions.push(`patient_id IN (SELECT id FROM patients WHERE doctor_id IN (SELECT id FROM profiles WHERE created_by = $${index}))`);
        values.push(userId);
        break;
      case 'notifications':
        // Admin sees notifications for themselves and their doctors
        conditions.push(`user_id IN (SELECT id FROM profiles WHERE created_by = $${index} OR id = $${index + 1})`);
        values.push(userId);
        values.push(userId);
        index++;
        break;
    }
  }

  // For doctors (role 'user'), enforce strict data isolation
  if (userRole === 'user') {
    switch (tableName) {
      case 'notifications':
        // Doctors can only see their own notifications
        // user_id in notifications table is the USER ID
        conditions.push(`user_id = $${index}`);
        values.push(userId);
        break;
      case 'patient_doctors':
        // Doctors can only see their own patient assignments
        // doctor_id is the PROFILE ID which equals USER ID for doctors
        conditions.push(`doctor_id = $${index}`);
        values.push(userId);
        break;
      case 'appointments':
        // Doctors can only see appointments:
        // 1) For patients they're assigned to via patient_doctors table, OR
        // 2) Appointments they created themselves
        conditions.push(`(patient_id IN (SELECT patient_id FROM patient_doctors WHERE doctor_id = $${index}) OR doctor_id = $${index + 1})`);
        values.push(userId);
        values.push(userId);
        index++;
        break;
      case 'patient_tasks':
        // Doctors can only see tasks for their patients
        // doctor_id is the PROFILE ID which equals USER ID for doctors
        conditions.push(`doctor_id = $${index}`);
        values.push(userId);
        break;
      case 'parent_activities':
        // Doctors see activities for patients assigned to them OR activities
        // explicitly addressed to them.
        conditions.push(`(patient_id IN (SELECT patient_id FROM patient_doctors WHERE doctor_id = $${index}) OR doctor_id = $${index + 1})`);
        values.push(userId);
        values.push(userId);
        index++;
        break;
      case 'treatments':
        // Doctors can only see treatments for their patients
        // Use subquery to get treatments only for this doctor's patients OR treatments they created
        conditions.push(`(patient_id IN (SELECT patient_id FROM patient_doctors WHERE doctor_id = $${index}) OR created_by = $${index + 1})`);
        values.push(userId);
        values.push(userId);
        index++;
        break;
      case 'attendance':
        // Doctors can only see attendance for their patients
        // Use subquery to get attendance only for this doctor's patients OR attendance they recorded
        conditions.push(`(patient_id IN (SELECT patient_id FROM patient_doctors WHERE doctor_id = $${index}) OR recorded_by = $${index + 1})`);
        values.push(userId);
        values.push(userId);
        index++;
        break;
    }
  }

  return { conditions, values };
};

// Generic GET all with filters
const createGetAllRoute = (tableName: string, orderBy: string | null = 'created_at') => {
  return async (req: AuthRequest, res: Response) => {
    try {
      const filters = req.query as Record<string, any>;
      let { conditions, values } = buildWhereClause(filters);
      
      // Apply access control for doctors
      const userRole = req.user?.role as string | null;
      const userId = req.user?.id as string;
      ({ conditions, values } = await addAccessControlFilter(tableName, userRole, userId, conditions, values));
      
      let sql = `SELECT * FROM ${tableName}`;
      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }
      if (orderBy && orderBy !== 'null') {
        sql += ` ORDER BY ${orderBy} DESC`;
      }

      const result = await query(sql, values);
      res.json(result.rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
};

// Generic GET one
const createGetOneRoute = (tableName: string) => {
  return async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const result = await query(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.json(result.rows[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
};

// --- Appointment ↔ Notification sync helpers -------------------------------
// Every appointment reminder notification carries a `[APT:<aptId>]` tag
// (with a legacy `(ID: <aptId>)` form) inside its `message`. To keep the
// reminder list in sync with the underlying appointment, we delete any
// notifications tied to the appointment id whenever it is created, updated
// or deleted. A fresh reminder is then (re)created by the frontend / the
// periodic Topbar sweep using the latest appointment state.
const deleteNotificationsForAppointment = async (aptId: string) => {
  try {
    const result = await query(
      `DELETE FROM notifications
       WHERE message LIKE $1 OR message LIKE $2 OR message LIKE $3
       RETURNING id`,
      [`%[APT:${aptId}]%`, `%(ID: ${aptId})%`, `%${aptId}%`]
    );
    console.log(`[CRUD] Cleaned ${result.rowCount} notification(s) for appointment ${aptId}`);
  } catch (err: any) {
    console.error('[CRUD] Failed to cleanup notifications for appointment', aptId, err.message);
  }
};

const purgeStaleAppointmentNotifications = async () => {
  // Best-effort sweep: drop any appointment-tagged notification that is older
  // than 2 days, or whose underlying appointment no longer exists / is past /
  // cancelled / completed. Runs lazily on every appointment write so we never
  // need a cron job.
  try {
    await query(
      `DELETE FROM notifications
       WHERE type IN ('warning', 'appointment')
         AND message ~ '\\[APT:[a-f0-9-]+\\]'
         AND (
           created_at < NOW() - INTERVAL '2 days'
           OR NOT EXISTS (
             SELECT 1 FROM appointments a
             WHERE notifications.message LIKE '%[APT:' || a.id || ']%'
               AND a.date > NOW()
               AND a.status NOT IN ('ملغي', 'مكتمل')
           )
         )`
    );
  } catch (err: any) {
    // Some Postgres configs may not support POSIX regex via ~ with that class,
    // fall back to a simpler sweep.
    try {
      await query(
        `DELETE FROM notifications
         WHERE type IN ('warning', 'appointment')
           AND message LIKE '%[APT:%'
           AND created_at < NOW() - INTERVAL '2 days'`
      );
    } catch (err2: any) {
      console.error('[CRUD] Stale notification sweep failed:', err2.message);
    }
  }
};

// Generic POST
const createInsertRoute = (tableName: string) => {
  return async (req: AuthRequest, res: Response) => {
    try {
      const data = req.body;
      const id = data.id || uuidv4();
      
      const fields = Object.keys(data).filter(k => k !== 'id');
      fields.unshift('id');
      
      const values = [id, ...fields.slice(1).map(f => data[f])];
      
      if (!fields.includes('created_at')) {
        fields.push('created_at');
        values.push(new Date());
      }
      
      const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
      const sql = `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`;
      console.log(`[CRUD] Insert ${tableName}:`, { fields, valueCount: values.length, placeholderCount: fields.length });
      const result = await query(sql, values);

      // When an appointment is created, make sure no stale notification for
      // this id exists (e.g. from a previous soft-reset), then let the
      // frontend create a fresh one.
      if (tableName === 'appointments') {
        await deleteNotificationsForAppointment(result.rows[0].id);
        await purgeStaleAppointmentNotifications();
      }

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      console.error(`[CRUD] Insert error on ${tableName}:`, error.message);
      res.status(500).json({ error: error.message });
    }
  };
};

// Generic PUT
const createUpdateRoute = (tableName: string) => {
  return async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const data = req.body;

      const fields = Object.keys(data).filter(k => k !== 'id');
      const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
      const values = [id, ...fields.map(f => data[f])];

      const sql = `UPDATE ${tableName} SET ${setClause} WHERE id = $1 RETURNING *`;
      console.log(`[CRUD] Update ${tableName} id=${id}:`, { fields });
      const result = await query(sql, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Not found' });
      }

      // On appointment update (e.g. date/status change), drop every linked
      // notification. The frontend will recreate a single fresh reminder if
      // still relevant.
      if (tableName === 'appointments') {
        await deleteNotificationsForAppointment(id);
        await purgeStaleAppointmentNotifications();
      }

      res.json(result.rows[0]);
    } catch (error: any) {
      console.error(`[CRUD] Update error on ${tableName}:`, error.message);
      res.status(500).json({ error: error.message });
    }
  };
};

// Generic DELETE
const createDeleteRoute = (tableName: string) => {
  return async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // When an appointment is deleted, also remove any linked notifications
      // so the bell count stays accurate.
      if (tableName === 'appointments') {
        await deleteNotificationsForAppointment(id);
      }

      await query(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
};

// Tables configuration with their order-by columns
const tablesConfig: { name: string; orderBy: string | null }[] = [
  { name: 'profiles', orderBy: 'created_at' },
  { name: 'patients', orderBy: 'created_at' },
  { name: 'parents', orderBy: 'created_at' },
  { name: 'appointments', orderBy: 'created_at' },
  { name: 'treatments', orderBy: 'created_at' },
  { name: 'treatment_medications', orderBy: 'created_at' },
  { name: 'attendance', orderBy: 'created_at' },
  { name: 'patient_tasks', orderBy: 'created_at' },
  { name: 'task_reports', orderBy: 'created_at' },
  { name: 'parent_activities', orderBy: 'created_at' },
  { name: 'notifications', orderBy: 'created_at' },
  { name: 'messages', orderBy: 'created_at' },
  { name: 'centers', orderBy: 'created_at' },
  { name: 'user_roles', orderBy: null },
  { name: 'patient_doctors', orderBy: 'created_at' },
];

// Create routes for each table
tablesConfig.forEach(({ name, orderBy }) => {
  router.get(`/${name}`, authenticateToken, createGetAllRoute(name, orderBy));
  router.get(`/${name}/:id`, authenticateToken, createGetOneRoute(name));
  router.post(`/${name}`, authenticateToken, createInsertRoute(name));
  router.put(`/${name}/:id`, authenticateToken, createUpdateRoute(name));
  router.delete(`/${name}/:id`, authenticateToken, createDeleteRoute(name));
});

// Special endpoints

// Batch delete patient_doctors by patient_id
router.delete('/patient_doctors/by-patient/:patientId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { patientId } = req.params;
    await query('DELETE FROM patient_doctors WHERE patient_id = $1', [patientId]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Batch insert patient_doctors
router.post('/patient_doctors/batch', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = req.body;
    
    for (const row of rows) {
      const id = uuidv4();
      await query(
        'INSERT INTO patient_doctors (id, patient_id, doctor_id, created_at) VALUES ($1, $2, $3, NOW())',
        [id, row.patient_id, row.doctor_id]
      );
    }
    
    res.status(201).json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
