import { Pool } from 'pg';
import { logger } from '../utils/logger.js';

export class MessageRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async findById(id: number): Promise<any> {
    const result = await this.pool.query('SELECT * FROM messages WHERE id = $1', [id]);
    return result.rows[0];
  }

  async findByTelegramIds(telegramChatId: number, telegramMessageId: number): Promise<any> {
    const result = await this.pool.query('SELECT * FROM messages WHERE telegram_chat_id = $1 AND telegram_message_id = $2', [
      telegramChatId,
      telegramMessageId,
    ]);
    return result.rows[0];
  }

  async create(message: any): Promise<any> {
    const result = await this.pool.query(
      `INSERT INTO messages (
        channel_id, telegram_message_id, telegram_chat_id, sender_id, sender_username,
        sender_first_name, sender_last_name, message, parsed_text, entities, raw_json,
        created_at, edited_at, views, forwards, reply_to_id, grouped_id, media_info, is_deleted, deleted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *`,
      [
        message.channel_id,
        message.telegram_message_id,
        message.telegram_chat_id,
        message.sender_id,
        message.sender_username,
        message.sender_first_name,
        message.sender_last_name,
        message.message,
        message.parsed_text,
        message.entities,
        message.raw_json,
        message.created_at,
        message.edited_at,
        message.views,
        message.forwards,
        message.reply_to_id,
        message.grouped_id,
        message.media_info,
        message.is_deleted || false,
        message.deleted_at,
      ]
    );
    return result.rows[0];
  }

  async update(id: number, updates: Partial<any>): Promise<any> {
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');

    const result = await this.pool.query(
      `UPDATE messages SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, id]
    );

    return result.rows[0];
  }

  async findByChannel(
    channelId: number,
    options: {
      cursor?: string;
      limit?: number;
      fromDate?: Date;
      toDate?: Date;
      search?: string;
      hashtags?: string[];
      hasLink?: boolean;
      includeDeleted?: boolean;
    } = {}
  ): Promise<{ messages: any[]; hasMore: boolean }> {
    const limit = options.limit || 50;
    let query = 'SELECT * FROM messages WHERE channel_id = $1';
    const params: any[] = [channelId];

    if (!options.includeDeleted) {
      query += ' AND is_deleted = FALSE';
    }

    if (options.fromDate) {
      query += ` AND created_at >= $${params.length + 1}`;
      params.push(options.fromDate);
    }

    if (options.toDate) {
      query += ` AND created_at <= $${params.length + 1}`;
      params.push(options.toDate);
    }

    if (options.search) {
      query += ` AND to_tsvector('english', COALESCE(parsed_text, '')) @@ to_tsquery('english', $authority ${params.length + 1})`;
      params.push(options.search.split(' ').join(' & '));
    }

    if (options.hashtags && options.hashtags.length > 0) {
      const hashtagConditions = options.hashtags.map((_, index) => `$${params.length + index + 1}`).join(' OR ');
      query += ` AND EXISTS (SELECT 1 FROM hashtags WHERE message_id = messages.id AND hashtag IN (${hashtagConditions}))`;
      params.push(...options.hashtags);
    }

    if (options.hasLink) {
      query += ' AND EXISTS (SELECT 1 FROM urls WHERE message_id = messages.id)';
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, options.cursor ? parseInt(options.cursor, 10) : 0);

    const result = await this.pool.query(query, params);

    let hasMore = false;
    if (result.rows.length === limit) {
      hasMore = true;
    }

    return { messages: result.rows, hasMore };
  }

  async getCount(channelId: number, options: { includeDeleted?: boolean } = {}): Promise<number> {
    let query = 'SELECT COUNT(*) FROM messages WHERE channel_id = $1';
    const params = [channelId];

    if (!options.includeDeleted) {
      query += ' AND is_deleted = FALSE';
    }

    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0].count);
  }
}