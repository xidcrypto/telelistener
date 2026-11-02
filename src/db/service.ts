import { Pool } from 'pg';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import { logger } from './utils/logger.js';
import { config } from './config/index.js';
import { MessageRepository } from './db/repositories/message.js';
import { ChannelRepository } from './db/repositories/channel.js';
import { WebhookRepository } from './db/repositories/webhook.js';
import { UserRepository } from './db/repositories/user.js';
import { RevisionRepository } from './db/repositories/revision.js';
import { MediaRepository } from './db/repositories/media.js';

export class DatabaseService {
  private pool?: Pool;
  private messageRepository?: MessageRepository;
  private channelRepository?: ChannelRepository;
  private webhookRepository?: WebhookRepository;
  private userRepository?: UserRepository;
  private revisionRepository?: RevisionRepository;
  private mediaRepository?: MediaRepository;

  public async initialize(): Promise<void> {
    await this.runMigrations();

    const poolConfig = {
      connectionString: config.databaseUrl,
      max: config.databasePoolSize,
      ssl:
        config.production || config.databaseUrl.includes('localhost')
          ? false
          : {
              rejectUnauthorized: true,
            },
    };

    this.pool = new Pool(poolConfig);

    this.pool.on('error', (err) => {
      logger.error({ error: err }, 'Unexpected database error');
    });

    await this.initializeRepositories();

    logger.info('Database initialized');
  }

  public async checkHealth(): Promise<{ status: string; error?: string }> {
    try {
      const result = await this.pool!.query('SELECT 1');
      return { status: 'ok' };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  public get message(): MessageRepository {
    return this.messageRepository!;
  }

  public get channel(): ChannelRepository {
    return this.channelRepository!;
  }

  public get webhook(): WebhookRepository {
    return this.webhookRepository!;
  }

  public get user(): UserRepository {
    return this.userRepository!;
  }

  public get revision(): RevisionRepository {
    return this.revisionRepository!;
  }

  public get media(): MediaRepository {
    return this.mediaRepository!;
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      logger.info('Database pool closed');
    }
  }

  public async getStatus(): Promise<Record<string, any>> {
    const status: Record<string, any> = {};

    try {
      const result = await this.pool!.query('SELECT COUNT(*) FROM messages');
      status.messagesTotal = parseInt(result.rows[0].count);

      const latestResult = await this.pool!.query('SELECT created_at FROM messages ORDER BY created_at DESC LIMIT 1');
      status.lastMessageTime = latestResult.rows[0]?.created_at;
    } catch (error) {
      status.error = error instanceof Error ? error.message : String(error);
    }

    return status;
  }

  private async runMigrations(): Promise<void> {
    const migrationsDir = join(process.cwd(), 'migrations');

    if (!import('fs').then(fs => fs.existsSync(migrationsDir))) {
      logger.warn('Migrations directory not found');
      return;
    }

    const migrationFiles = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    const { default: Client } = await import('pg');
    const migrationPool = new Client({
      connectionString: config.databaseUrl,
      ssl:
        config.production || config.databaseUrl.includes('localhost')
          ? false
          : {
              rejectUnauthorized: true,
            },
    });

    await migrationPool.connect();

    try {
      await migrationPool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP)');

      for (const file of migrationFiles) {
        const version = file.replace('.sql', '');

        const result = await migrationPool.query('SELECT version FROM schema_migrations WHERE version = $1', [version]);

        if (result.rows.length === 0) {
          const sql = import('fs').then(fs => fs.readFileSync(join(migrationsDir, file), 'utf8'));
          await migrationPool.query(await sql);

          await migrationPool.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);

          logger.info({ version }, 'Migration applied');
        } else {
          logger.debug({ version }, 'Migration already applied');
        }
      }
    } finally {
      await migrationPool.end();
    }
  }

  private async initializeRepositories(): Promise<void> {
    this.messageRepository = new MessageRepository(this.pool!);
    this.channelRepository = new ChannelRepository(this.pool!);
    this.webhookRepository = new WebhookRepository(this.pool!);
    this.userRepository = new UserRepository(this.pool!);
    this.revisionRepository = new RevisionRepository(this.pool!);
    this.mediaRepository = new MediaRepository(this.pool!);
  }
}