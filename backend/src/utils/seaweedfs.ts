import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import pathModule from "path";
import dotenv from "dotenv";

dotenv.config();

const SEAWEEDFS_FILER_URL = process.env.SEAWEEDFS_FILER_URL || "";
const SEAWEEDFS_USERNAME = process.env.SEAWEEDFS_USERNAME || "";
const SEAWEEDFS_PASSWORD = process.env.SEAWEEDFS_PASSWORD || "";

// Local uploads directory as fallback
const LOCAL_UPLOADS_DIR = pathModule.join(process.cwd(), "uploads");

class SeaweedFSClient {
  private filerUrl: string;
  private username: string;
  private password: string;
  private useLocalFallback: boolean;

  constructor() {
    this.filerUrl = SEAWEEDFS_FILER_URL;
    this.username = SEAWEEDFS_USERNAME;
    this.password = SEAWEEDFS_PASSWORD;
    this.useLocalFallback = false;

    if (!this.filerUrl) {
      console.log("[Storage] No SeaweedFS URL configured, using local filesystem storage");
      this.useLocalFallback = true;
    } else {
      console.log(`[Storage] SeaweedFS Filer URL: ${this.filerUrl}`);
      console.log(`[Storage] Auth user: ${this.username || "none"}`);
    }

    // Ensure local uploads directory exists
    this.ensureLocalDirs();
  }

  private ensureLocalDirs() {
    const dirs = [
      LOCAL_UPLOADS_DIR,
      pathModule.join(LOCAL_UPLOADS_DIR, "images"),
      pathModule.join(LOCAL_UPLOADS_DIR, "audio"),
    ];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[Storage] Created directory: ${dir}`);
      }
    }
  }

  /**
   * Basic Auth Header (optional)
   */
  private getAuthHeader(): Record<string, string> {
    if (!this.username || !this.password) return {};

    const credentials = Buffer.from(
      `${this.username}:${this.password}`
    ).toString("base64");

    return {
      Authorization: `Basic ${credentials}`,
    };
  }

  /**
   * Save buffer to local filesystem
   */
  private async saveLocally(
    buffer: Buffer,
    fileName: string,
    collection?: string
  ): Promise<{ url: string; fileId: string }> {
    const subDir = collection || "files";
    const dirPath = pathModule.join(LOCAL_UPLOADS_DIR, subDir);

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const filePath = pathModule.join(dirPath, fileName);
    fs.writeFileSync(filePath, buffer);

    console.log(`[Storage] Saved locally: ${filePath} (${buffer.length} bytes)`);

    const fileId = `/${subDir}/${fileName}`;
    return {
      fileId,
      url: `/api/uploads/${subDir}/${fileName}`,
    };
  }

  /**
   * Upload buffer - tries SeaweedFS first, falls back to local filesystem
   */
  async uploadBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    collection?: string
  ): Promise<{ url: string; fileId: string }> {
    // If already known to use local fallback, skip SeaweedFS attempt
    if (this.useLocalFallback) {
      return this.saveLocally(buffer, fileName, collection);
    }

    try {
      const filerPath = collection
        ? `/ehs/${collection}/${fileName}`
        : `/ehs/${fileName}`;

      const url = `${this.filerUrl}${filerPath}`;

      const form = new FormData();

      form.append("file", buffer, {
        filename: fileName,
        contentType: mimeType || "application/octet-stream",
      });

      console.log(`[Storage] Uploading to SeaweedFS → ${url}`);
      console.log(`[Storage] Size → ${buffer.length} bytes`);

      const response = await axios.post(url, form, {
        headers: {
          ...form.getHeaders(),
          ...this.getAuthHeader(),
        },
        timeout: 5000, // Short timeout to fail fast
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      console.log("[Storage] SeaweedFS upload success:", response.status);

      return {
        fileId: filerPath,
        url: `/api/files${filerPath}`,
      };
    } catch (error: any) {
      // If connection refused, switch to local fallback permanently for this session
      if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND" || error.code === "ETIMEDOUT") {
        console.warn(`[Storage] SeaweedFS unavailable (${error.code}), switching to local filesystem storage`);
        this.useLocalFallback = true;
        return this.saveLocally(buffer, fileName, collection);
      }

      console.error("[Storage] Upload error:", error.message);
      console.error("[Storage] Status:", error?.response?.status);

      // For other errors, also try local fallback
      console.warn("[Storage] Falling back to local filesystem storage");
      return this.saveLocally(buffer, fileName, collection);
    }
  }

  /**
   * Upload file from disk
   */
  async uploadFile(
    filePath: string,
    fileName: string,
    collection?: string
  ) {
    try {
      const buffer = fs.readFileSync(filePath);
      return this.uploadBuffer(buffer, fileName, "", collection);
    } catch (error: any) {
      console.error("[Storage] Upload file error:", error.message);
      throw new Error("Failed to upload file");
    }
  }

  /**
   * Delete file - tries SeaweedFS first, then local
   */
  async deleteFile(fileId: string): Promise<void> {
    // Try local delete
    const localPath = pathModule.join(LOCAL_UPLOADS_DIR, fileId.replace(/^\//, ""));
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
      console.log("[Storage] Deleted local file:", localPath);
      return;
    }

    // Try SeaweedFS delete
    if (!this.useLocalFallback && this.filerUrl) {
      try {
        const cleanPath = fileId.startsWith("/") ? fileId : `/${fileId}`;
        const url = `${this.filerUrl}${cleanPath}`;

        console.log(`[Storage] Deleting from SeaweedFS → ${url}`);

        await axios.delete(url, {
          headers: this.getAuthHeader(),
          timeout: 10000,
        });

        console.log("[Storage] Deleted from SeaweedFS:", cleanPath);
      } catch (error: any) {
        console.error("[Storage] Delete error:", error.message);
      }
    }
  }

  /**
   * Get direct filer URL
   */
  getFilerUrl(path: string): string {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    if (this.useLocalFallback) {
      return `/api/uploads${cleanPath}`;
    }
    return `${this.filerUrl}${cleanPath}`;
  }
}

export const seaweedfs = new SeaweedFSClient();
export default seaweedfs;