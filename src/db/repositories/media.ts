import { Pool } from 'pg';
import { logger } from '../utils/logger.js';

export class MediaRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async create(media: any): Promise<any> {
    const result = await this.pool.query(
      `INSERT INTO media_files (
        message_id, file_name, stored_path, file_size, mime_type,
        telegram_file_id, created_at, clamd_scan_result, checksum
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        media.messageId,
        media.fileName,
        media.storedPath,
        media.fileSize,
        media.mimeType,
        media.telegramFileId,
        media.createdAt || new Date(),
        media.clamdScanResult,
        media.checksum,
      ]
    );
    return result.rows[0];
  }

  async findById(id: number): Promise<any> {
    const result = await this.pool.query('SELECT * FROM media_files WHERE id = $1', [id]);
    return result.rows[0];
  }

  async findByMessage(messageId: number): Promise<any[]> {
    const result = await this.pool.query('SELECT * FROM media_files WHERE message_id = $1', [messageId]);
    return result.rows;
  }

  async delete(id: number): Promise<void> {
    await this.pool.query('DELETE FROM media_files WHERE id = $1', [id]);
  }
}