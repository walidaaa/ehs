import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

// Get all tables metadata
router.get('/admin/tables', authenticateToken, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT 
        tablename,
        COALESCE(tableowner, 'unknown') as owner
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get table structure and data
router.get('/admin/tables/:tableName', authenticateToken, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { tableName } = req.params;
    
    // Validate table name to prevent SQL injection
    const tableNameResult = await query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = $1
    `, [tableName]);
    
    if (tableNameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Table not found' });
    }
    
    // Get table columns info
    const columnsResult = await query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    
    // Get table data with limit
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    
    const dataResult = await query(`
      SELECT * FROM ${tableName}
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total FROM ${tableName}
    `);
    
    res.json({
      table: tableName,
      columns: columnsResult.rows,
      rows: dataResult.rows,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update a row
router.put('/admin/tables/:tableName/:id', authenticateToken, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { tableName, id } = req.params;
    const data = req.body;
    
    // Validate table exists
    const tableResult = await query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = $1
    `, [tableName]);
    
    if (tableResult.rows.length === 0) {
      return res.status(404).json({ error: 'Table not found' });
    }
    
    const fields = Object.keys(data).filter(k => k !== 'id');
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = [id, ...fields.map(f => data[f])];
    
    const sql = `UPDATE ${tableName} SET ${setClause} WHERE id = $1 RETURNING *`;
    const result = await query(sql, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Row not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('[v0] Database update error:', error.message);
    
    // Better error messages
    if (error.message.includes('invalid input value for enum')) {
      return res.status(400).json({ error: 'Invalid value for this field. Please select from available options.' });
    }
    
    if (error.message.includes('violates unique constraint')) {
      return res.status(400).json({ error: 'This value already exists. Please use a different value.' });
    }
    
    if (error.message.includes('violates foreign key constraint')) {
      return res.status(400).json({ error: 'This reference does not exist. Please select a valid option.' });
    }
    
    res.status(500).json({ error: 'Failed to update record: ' + error.message });
  }
});

// Delete a row
router.delete('/admin/tables/:tableName/:id', authenticateToken, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { tableName, id } = req.params;
    
    // Validate table exists
    const tableResult = await query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = $1
    `, [tableName]);
    
    if (tableResult.rows.length === 0) {
      return res.status(404).json({ error: 'Table not found' });
    }
    
    const result = await query(`DELETE FROM ${tableName} WHERE id = $1 RETURNING *`, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Row not found' });
    }
    
    res.json({ success: true, deletedRow: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Insert a new row
router.post('/admin/tables/:tableName', authenticateToken, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { tableName } = req.params;
    const data = req.body;
    
    // Validate table exists
    const tableResult = await query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = $1
    `, [tableName]);
    
    if (tableResult.rows.length === 0) {
      return res.status(404).json({ error: 'Table not found' });
    }
    
    const fields = Object.keys(data);
    const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
    const values = fields.map(f => data[f]);
    
    const sql = `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await query(sql, values);
    
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get enum values for a column
router.get('/admin/enums/:enumType', authenticateToken, requireRole('super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { enumType } = req.params;
    
    // Get enum values from database
    const result = await query(`
      SELECT enum_range(NULL::${enumType})::text[] as values
    `);
    
    if (result.rows.length > 0) {
      const values = result.rows[0].values;
      res.json({ values });
    } else {
      res.json({ values: [] });
    }
  } catch (error: any) {
    console.error('[v0] Error fetching enum values:', error.message);
    res.status(500).json({ error: 'Failed to fetch enum values' });
  }
});

// Get current user info
router.get('/admin/user-info', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
