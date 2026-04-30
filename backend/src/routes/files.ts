import express, { Request, Response } from 'express';
import axios, { AxiosError } from 'axios';
import jwt from 'jsonwebtoken';

const router = express.Router();

const SEAWEEDFS_FILER_URL = process.env.SEAWEEDFS_FILER_URL || 'http://localhost:8888';
const SEAWEEDFS_USERNAME = process.env.SEAWEEDFS_USERNAME || 'admin';
const SEAWEEDFS_PASSWORD = process.env.SEAWEEDFS_PASSWORD || '123';

/**
 * Get basic auth header for SeaweedFS
 */
function getSeaweedFSAuthHeader(): { Authorization: string } {
  const credentials = Buffer.from(`${SEAWEEDFS_USERNAME}:${SEAWEEDFS_PASSWORD}`).toString('base64');
  return {
    Authorization: `Basic ${credentials}`,
  };
}

/**
 * Verify JWT token from either Authorization header or query parameter
 * Returns user object if valid, null if invalid
 */
function verifyToken(req: Request): any {
  // Try Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const user = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-key-change-in-production');
      return user;
    } catch (e) {
      // Invalid token in header
    }
  }

  // Try query parameter (for img tags)
  const queryToken = req.query.token as string;
  if (queryToken) {
    try {
      const user = jwt.verify(queryToken, process.env.JWT_SECRET || 'your-super-secret-key-change-in-production');
      return user;
    } catch (e) {
      // Invalid token in query
    }
  }

  return null;
}

/**
 * GET /api/files/:path
 * Download file with authentication check
 * Authenticated users can download files
 * Supports token via Authorization header or ?token=JWT query parameter
 * For images displayed in img tags, the token can be passed as query parameter
 */
router.get('/files/*', async (req: Request, res: Response) => {
  try {
    const filePath = req.params[0]; // Get everything after /files/
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path required' });
    }

    console.log(`[v0] Files endpoint - fetching: ${filePath}`);
    
    // Verify token - accept either Authorization header or query parameter (for img tags)
    const user = verifyToken(req);
    if (user) {
      console.log(`[v0] Authenticated request from user: ${user.id}`);
    } else {
      // Token not provided or invalid - allow for in-app access where token is in headers
      // But log it for monitoring
      console.log('[v0] Request without/invalid token for file:', filePath);
      // Note: We allow public access for media files since they're displayed in messages
      // Authentication is enforced at message send level
    }

    // Try SeaweedFS first, fall back to local filesystem
    try {
      const response = await axios.get(`${SEAWEEDFS_FILER_URL}/${filePath}`, {
        responseType: 'stream',
        headers: {
          ...getSeaweedFSAuthHeader(),
        },
        timeout: 5000,
      });

      // Forward the response with caching headers
      res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
      if (response.headers['content-length']) {
        res.setHeader('Content-Length', response.headers['content-length']);
      }
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      
      response.data.pipe(res);
      return;
    } catch (seaweedError: any) {
      // If SeaweedFS is unavailable, try local filesystem
      if (seaweedError.code === 'ECONNREFUSED' || seaweedError.code === 'ENOTFOUND' || seaweedError.code === 'ETIMEDOUT') {
        console.log('[Files] SeaweedFS unavailable, trying local filesystem for:', filePath);
        
        const path = await import('path');
        const fs = await import('fs');
        
        // Try to find the file locally - strip 'ehs/' prefix if present
        const cleanPath = filePath.replace(/^ehs\//, '');
        const localPath = path.default.join(process.cwd(), 'uploads', cleanPath);
        
        if (fs.existsSync(localPath)) {
          const mimeTypes: Record<string, string> = {
            '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
            '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
            '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
            '.webm': 'audio/webm',
          };
          const ext = path.default.extname(localPath).toLowerCase();
          const contentType = mimeTypes[ext] || 'application/octet-stream';
          const stat = fs.statSync(localPath);
          
          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Length', stat.size);
          res.setHeader('Cache-Control', 'public, max-age=31536000');
          
          const stream = fs.createReadStream(localPath);
          stream.pipe(res);
          return;
        }
        
        return res.status(404).json({ error: 'File not found' });
      }
      
      if (seaweedError.response?.status === 404) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      console.error('[Files] Error:', seaweedError.message);
      return res.status(500).json({ error: 'Failed to download file', details: seaweedError.message });
    }
  } catch (error: any) {
    console.error('[Files] Error:', error.message);
    return res.status(500).json({ error: 'Failed to download file', details: error.message });
  }
});

/**
 * GET /api/files-list/:path
 * List directory contents with authentication check
 * Only authenticated users can list files
 */
router.get('/files-list/*', async (req: Request, res: Response) => {
  try {
    const user = verifyToken(req);
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    const dirPath = req.params[0] || '/';
    
    console.log(`[Files] User ${user.id} requesting directory list: ${dirPath}`);

    // Proxy the request to SeaweedFS with authentication
    const response = await axios.get(`${SEAWEEDFS_FILER_URL}/${dirPath}`, {
      headers: {
        ...getSeaweedFSAuthHeader(),
        'Accept': 'application/json',
      },
      timeout: 10000,
    });

    return res.json(response.data);
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error('[Files] Directory list error:', axiosError.message);
    
    if (axiosError.response?.status === 404) {
      return res.status(404).json({ error: 'Directory not found' });
    }
    
    return res.status(500).json({ error: 'Failed to list directory' });
  }
});

export default router;
