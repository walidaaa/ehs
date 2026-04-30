import { Router, Response, Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import seaweedfs from '../utils/seaweedfs';

const router = Router();

// Get file extension from content type
const getExtensionFromMimeType = (mimeType: string): string => {
  const mimeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'audio/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
  };
  return mimeMap[mimeType] || 'bin';
};

// Upload endpoint - expects JSON with base64 encoded file
// Uploads to SeaweedFS Filer and returns the URL
router.post('/upload', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    console.log('[Upload] Request received from user:', req.user?.id);
    const { filename, contentType, data } = req.body;

    if (!data || !filename) {
      console.log('[Upload] ERROR: Missing data or filename');
      return res.status(400).json({ error: 'Missing file data or filename' });
    }

    // Decode base64 to buffer
    const fileBuffer = Buffer.from(data, 'base64');

    if (fileBuffer.length === 0) {
      return res.status(400).json({ error: 'File is empty' });
    }

    // Limit file size to 50MB
    if (fileBuffer.length > 50 * 1024 * 1024) {
      return res.status(413).json({ error: 'File too large' });
    }

    // Generate unique filename
    const fileId = uuidv4();
    const ext = getExtensionFromMimeType(contentType) || filename.split('.').pop() || 'bin';
    const safeFilename = `${fileId}.${ext}`;

    // Determine collection (subdirectory) based on file type
    const collection = contentType.startsWith('audio/') ? 'audio' : 'images';

    console.log(`[Upload] Uploading to SeaweedFS: ${safeFilename} (${fileBuffer.length} bytes, collection: ${collection})`);

    // Upload to SeaweedFS Filer
    const result = await seaweedfs.uploadBuffer(fileBuffer, safeFilename, contentType, collection);

    console.log(`[Upload] File uploaded to SeaweedFS: ${result.fileId}, URL: ${result.url}`);
    return res.json({ url: result.url, fileId: result.fileId, filename: safeFilename });
  } catch (error: any) {
    console.error('[Upload] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;