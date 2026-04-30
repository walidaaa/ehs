import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Debug endpoint - check if user exists
router.get('/debug/users', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT id, email FROM users LIMIT 10');
    res.json({ users: result.rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Generate tokens
const generateTokens = (userId: string, email: string) => {
  const accessToken = jwt.sign(
    { id: userId, email },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  const refreshToken = jwt.sign(
    { id: userId, email, type: 'refresh' },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  return { accessToken, refreshToken };
};

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user
    console.log('[AUTH] Searching for user:', email.toLowerCase());
    const userResult = await query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    console.log('[AUTH] User query returned:', userResult.rows.length, 'rows');
    
    if (userResult.rows.length === 0) {
      console.log('[AUTH] User not found:', email);
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    const user = userResult.rows[0];

    // Verify password
    console.log('[AUTH] Login attempt for:', email);
    console.log('[AUTH] User found:', user.email);
    console.log('[AUTH] Password hash exists:', !!user.password_hash);
    console.log('[AUTH] Password hash length:', user.password_hash.length);
    
    const validPassword = await bcrypt.compare(password, user.password_hash);
    console.log('[AUTH] Password valid:', validPassword);
    
    if (!validPassword) {
      console.log('[AUTH] Invalid password for user:', email);
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    // Get role
    const roleResult = await query(
      'SELECT role FROM user_roles WHERE user_id = $1 LIMIT 1',
      [user.id]
    );

    // Get profile
    const profileResult = await query(
      'SELECT full_name, phone FROM profiles WHERE id = $1',
      [user.id]
    );

    const tokens = generateTokens(user.id, user.email);

    res.json({
      user: {
        id: user.id,
        email: user.email,
      },
      profile: profileResult.rows[0] || null,
      role: roleResult.rows[0]?.role || null,
      ...tokens,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Refresh token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET || 'secret') as {
      id: string;
      email: string;
      type: string;
    };

    if (decoded.type !== 'refresh') {
      return res.status(403).json({ error: 'Invalid token type' });
    }

    const tokens = generateTokens(decoded.id, decoded.email);
    res.json(tokens);
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired refresh token' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const profileResult = await query(
      'SELECT id, full_name, phone FROM profiles WHERE id = $1',
      [userId]
    );

    const roleResult = await query(
      'SELECT role FROM user_roles WHERE user_id = $1 LIMIT 1',
      [userId]
    );

    // For doctors, get their profile ID (same as user ID)
    // This is used for filtering appointments, patient_doctors, etc.
    const profile = profileResult.rows[0];
    const role = roleResult.rows[0]?.role || null;

    res.json({
      user: {
        id: userId,
        email: req.user!.email,
      },
      profile: profile || null,
      role: role,
      // For doctors: profile.id is the doctor_id used in appointments table
      doctorId: role === 'user' ? (profile?.id || userId) : null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Change password
router.post('/change-password', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.id;

    const userResult = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const validPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, userId]);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Change password for another user (super admin only)
router.post('/change-admin-password', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { targetUserId, newPassword } = req.body;
    const adminId = req.user!.id;
    const adminRole = req.user!.role;

    // Verify admin is super_admin
    if (adminRole !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admin can change user passwords' });
    }

    // Verify target user exists
    const userResult = await query(
      'SELECT id FROM users WHERE id = $1',
      [targetUserId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, targetUserId]);

    console.log(`[AUTH] Admin ${adminId} changed password for user ${targetUserId}`);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[AUTH] Admin password change error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create user (admin only)
router.post('/create-user', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, full_name, phone, role, specialty, service_name } = req.body;
    const creatorId = req.user!.id;
    const creatorRole = req.user!.role;

    // Validate required fields
    if (!email || !password || !full_name || !role) {
      console.log('[CREATE-USER] Missing required fields:', { email: !!email, password: !!password, full_name: !!full_name, role: !!role });
      return res.status(400).json({ error: 'Email, password, full_name, and role are required' });
    }

    // Validate role permissions
    if (creatorRole === 'admin' && !['user', 'receptionist'].includes(role)) {
      return res.status(403).json({ error: 'Admin can only create users or receptionists' });
    }
    if (creatorRole === 'user' && role !== 'parent') {
      return res.status(403).json({ error: 'Doctors can only create parents' });
    }

    // Check if email exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'EMAIL_ALREADY_REGISTERED' });
    }

    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log('[CREATE-USER] Creating user:', { userId, email: email.toLowerCase(), role, creatorRole });

    // Create user
    await query(
      'INSERT INTO users (id, email, password_hash, created_at) VALUES ($1, $2, $3, NOW())',
      [userId, email.toLowerCase(), hashedPassword]
    );

    // Create profile
    await query(
      'INSERT INTO profiles (id, full_name, phone, specialty, service_name, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())',
      [userId, full_name, phone || null, specialty || null, service_name || null, creatorId]
    );

    // Create role
    await query(
      'INSERT INTO user_roles (id, user_id, role) VALUES ($1, $2, $3)',
      [uuidv4(), userId, role]
    );

    console.log('[CREATE-USER] User created successfully:', userId);
    res.json({ id: userId, email, full_name, role });
  } catch (error: any) {
    console.error('Create user error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete user
router.delete('/users/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await query('DELETE FROM user_roles WHERE user_id = $1', [id]);
    await query('DELETE FROM profiles WHERE id = $1', [id]);
    await query('DELETE FROM users WHERE id = $1', [id]);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
