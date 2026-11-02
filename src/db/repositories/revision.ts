import { Pool } from 'pg';
import { logger } from '../utils/logger.js';

export class RevisionRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async create(revision: any): Promise<any> {
    const result = await this.pool.query(
      `INSERT INTO message_revisions (
        message_id, revision_number, message, parsed_text, entities,
        created_at, edited_by, is_final
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        revision.messageId,
        revision.revisionNumber,
        revision.message,
        revision.parsedText,
        revision.entities,
        revision.createdAt || new Date(),
        revision.editedBy,
        revision.isFinal || false,
      ]
    );
    return result.rows[0];
  }

  async findByMessageId(messageId: number): Promise<any[]> {
    const result = await this.pool.query('SELECT * FROM message_revisions WHERE message_id = $1 ORDER BY revision_number', [
      messageId,
    ]);
    return result.rows;
  }

  async markAllAsNotFinal(messageId: number): Promise<void> {
    await this.pool.query('UPDATE message_revisions SET is_final = FALSE WHERE message_id = $1', [messageId]);
  }
}