import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
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
const HOST = process.env.HOST || '0.0.0.0';

// 🌍 Allowed frontend URLs
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://ehs-ain-abessa.vercel.app"
];

// =========================
// 🔐 CORS CONFIG (FIXED)
// =========================
app.use(cors({
  origin: (origin, callback) => {
    // allow tools like Postman / server-to-server
    if (!origin) return callback(null, true);

    const isAllowed =
      allowedOrigins.includes(origin) ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.includes('192.168.') ||
      origin.includes('10.') ||
      origin.match(/172\.(1[6-9]|2[0-9]|3[01])\./);

    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('[CORS BLOCKED]', origin);
      callback(null, false); // ❌ IMPORTANT: DO NOT THROW ERROR
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// =========================
// 🔧 MIDDLEWARE
// =========================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// =========================
// 📁 STATIC FILES
// =========================
app.use('/api/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(express.static(path.join(process.cwd(), 'public')));

// =========================
// ❤️ PRESENCE SYSTEM
// =========================
app.post('/api/presence', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user?.id || req.body.user_id;

    if (!userId) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const now = new Date().toISOString();

    const result = await query(
      'UPDATE profiles SET last_seen = $1 WHERE id = $2 RETURNING id, last_seen',
      [now, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ success: true, updated_at: result.rows[0].last_seen });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// =========================
// 🚀 ROUTES
// =========================
app.use('/api/auth', authRoutes);
app.use('/api', uploadRoutes);
app.use('/api', crudRoutes);
app.use('/api', filesRoutes);
app.use('/api', databaseRoutes);

// =========================
// ❤️ HEALTH CHECK
// =========================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString()
  });
});

// =========================
// 🚀 START SERVER
// =========================
app.listen(Number(PORT), HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
});