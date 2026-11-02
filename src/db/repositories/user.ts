import { Pool } from 'pg';
import { logger } from '../utils/logger.js';

export class UserRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async findByApiKeyPrefix(apiKeyPrefix: string): Promise<any> {
    const result = await this.pool.query('SELECT * FROM users WHERE api_key_prefix = $1 AND is_active = TRUE', [
      apiKeyPrefix,
    ]);
    return result.rows[0];
  }

  async create(user: any): Promise<any> {
    const result = await this.pool.query(
      `INSERT INTO users (
        api_key_hash, api_key_prefix, scopes, is_active, created_at,
        last_used_at, expires_at, failed_attempts, locked_until, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        user.apiKeyHash,
        user.apiKeyPrefix,
        user.scopes || ['read'],
        user.isActive !== false,
        user.createdAt || new Date(),
        user.lastUsedAt,
        user.expiresAt,
        user.failedAttempts || 0,
        user.lockedUntil,
        user.metadata,
      ]
    );
    return result.rows[0];
  }

  async update(id: number, updates: Partial<any>): Promise<any> {
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');

    const result = await this.pool.query(
      `UPDATE users SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, id]
    );

    return result.rows[0];
  }

  async incrementFailedAttempts(userId: number): Promise<any> {
    const user = await this.findById(userId);
    const failedAttempts = (user.failed_attempts || 0) + 1;
    const lockedUntil = failedAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

    return this.update(userId, {
      failed_attempts: failedAttempts,
      locked_until: lockedUntil,
    });
  }

  async resetFailedAttempts(userId: number): Promise<any> {
    return this.update(userId, {
      failed_attempts: 0,
      locked_until: null,
      last_used_at: new Date(),
    });
  }

  async findById(id: number): Promise<any> {
    const result = await this.pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  }

  async findAll(): Promise<any[]> {
    const result = await this.pool.query('SELECT id, api_key_prefix, scopes, is_active, created_at, last_used_at, expires_at FROM users ORDER BY created_at DESC');
    return result.rows;
  }
}