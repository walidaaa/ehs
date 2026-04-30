import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';
import authRoutes from './routes/auth';
import crudRoutes from './routes/crud';
import uploadRoutes from './routes/upload';
import filesRoutes from './routes/files';
import databaseRoutes from './routes/database';
import { query } from './config/database';
import { authenticateToken } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;
const HOST = process.env.HOST || 'localhost';
const SEAWEEDFS_FILER_URL = process.env.SEAWEEDFS_FILER_URL || 'http://localhost:8888';

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests from:
    // - no origin (direct requests, same-site)
    // - localhost and 127.0.0.1
    // - All local network IPs (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
    // - Mobile devices on same network
    if (!origin || 
        origin.includes('localhost') || 
        origin.includes('127.0.0.1') ||
        origin.includes('192.168.') ||
        origin.includes('10.') ||
        origin.match(/172\.(1[6-9]|2[0-9]|3[01])\./) ||
        origin.includes('192.') ||
        origin.includes('172.')) {
      callback(null, true);
    } else {
      console.log('[CORS] Rejected origin:', origin);
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));

// Note: File serving is now protected via /api/files/* routes in filesRoutes
// This requires authentication to prevent unauthorized access to media files

// Keep legacy static file serving for any existing local uploads
app.use('/api/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Serve public folder for database admin interface
app.use(express.static(path.join(process.cwd(), 'public')));

// Presence endpoint - updates last_seen in profiles table
app.post('/api/presence', authenticateToken, async (req: any, res: any) => {
  try {
    // Use authenticated user's ID from token, or fallback to body
    const userId = (req as any).user?.id || req.body.user_id;
    
    if (!userId) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    
    // Always use server's current UTC time to avoid client clock issues
    const nowUtc = new Date().toISOString();
    
    console.log('[PRESENCE] Updating last_seen for user:', userId, 'at:', nowUtc);
    
    const result = await query(
      'UPDATE profiles SET last_seen = $1 WHERE id = $2 RETURNING id, last_seen',
      [nowUtc, userId]
    );
    
    if (result.rows.length === 0) {
      console.warn('[PRESENCE] No profile found for user:', userId);
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    console.log('[PRESENCE] Update successful for user:', userId, 'last_seen:', result.rows[0].last_seen);
    res.json({ success: true, updated_at: result.rows[0].last_seen });
  } catch (error: any) {
    console.error('[PRESENCE] Error updating last_seen:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', uploadRoutes);
app.use('/api', crudRoutes);
app.use('/api', filesRoutes);
app.use('/api', databaseRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), seaweedfs: SEAWEEDFS_FILER_URL });
});

// Start server
app.listen(Number(PORT), String(HOST), () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`SeaweedFS Filer: ${SEAWEEDFS_FILER_URL}`);
});
