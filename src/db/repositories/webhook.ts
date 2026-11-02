import { Pool } from 'pg';
import { logger } from '../utils/logger.js';

export class WebhookRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async findById(id: number): Promise<any> {
    const result = await this.pool.query('SELECT * FROM webhooks WHERE id = $1', [id]);
    return result.rows[0];
  }

  async findByChannel(channelId: number): Promise<any[]> {
    const result = await this.pool.query('SELECT * FROM webhooks WHERE channel_id = $1 AND is_active = TRUE', [
      channelId,
    ]);
    return result.rows;
  }

  async create(webhook: any): Promise<any> {
    const result = await this.pool.query(
      `INSERT INTO webhooks (
        channel_id, url, secret, events, is_active, is_paused, pause_reason,
        retries, last_attempt_at, last_error, retry_history, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        webhook.channel_id,
        webhook.url,
        webhook.secret,
        webhook.events || '{new,edit,delete}',
        webhook.is_active !== false,
        webhook.is_paused || false,
        webhook.pause_reason,
        webhook.retries || 0,
        webhook.last_attempt_at,
        webhook.last_error,
        webhook.retry_history,
        webhook.created_at || new Date(),
        webhook.updated_at || new Date(),
      ]
    );
    return result.rows[0];
  }

  async update(id: number, updates: Partial<any>): Promise<any> {
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');

    const result = await this.pool.query(
      `UPDATE webhooks SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, id]
    );

    return result.rows[0];
  }

  async delete(id: number): Promise<void> {
    await this.pool.query('DELETE FROM webhooks WHERE id = $1', [id]);
  }

  async findAll(): Promise<any[]> {
    const result = await this.pool.query('SELECT * FROM webhooks ORDER BY created_at DESC');
    return result.rows;
  }
}