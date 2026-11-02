import { Pool } from 'pg';
import { logger } from '../utils/logger.js';

export class ChannelRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async findById(id: number): Promise<any> {
    const result = await this.pool.query('SELECT * FROM channels WHERE id = $1', [id]);
    return result.rows[0];
  }

  async findByTelegramId(telegramChannelId: number): Promise<any> {
    const result = await this.pool.query('SELECT * FROM channels WHERE telegram_channel_id = $1', [telegramChannelId]);
    return result.rows[0];
  }

  async findByUsername(username: string): Promise<any> {
    const result = await this.pool.query('SELECT * FROM channels WHERE username = $1', [username]);
    return result.rows[0];
  }

  async create(channel: any): Promise<any> {
    const result = await this.pool.query(
      `INSERT INTO channels (
        telegram_channel_id, username, title, is_forum, is_verified,
        member_count, description, added_at, last_activity, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        channel.telegram_channel_id,
        channel.username,
        channel.title,
        channel.is_forum || false,
        channel.is_verified || false,
        channel.member_count,
        channel.description,
        channel.added_at || new Date(),
        channel.last_activity,
        channel.is_active || true,
      ]
    );
    return result.rows[0];
  }

  async update(id: number, updates: Partial<any>): Promise<any> {
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');

    const result = await this.pool.query(
      `UPDATE channels SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, id]
    );

    return result.rows[0];
  }

  async getAll(): Promise<any[]> {
    const result = await this.pool.query('SELECT * FROM channels ORDER BY title');
    return result.rows;
  }
}