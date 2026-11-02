import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export class SessionManager {
  private sessionKey: Uint8Array;
  private sessionPath: string;

  constructor(sessionEncKey: string) {
    if (sessionEncKey.length !== 32) {
      throw new Error('SESSION_ENC_KEY must be 32 bytes (base64 encoded)');
    }

    this.sessionKey = Buffer.from(sessionEncKey, 'base64');
    const dataDir = process.env.XDG_DATA_HOME || join(process.env.HOME || '', '.local', 'share');
    this.sessionPath = join(dataDir, 'telegram-monitor', 'session.enc');
  }

  async initialize(): Promise<void> {
    const sessionFile = join(process.cwd(), '.telegram-session');

    if (!existsSync(sessionFile)) {
      logger.info('No existing session file found');
      return;
    }

    try {
      const encrypted = readFileSync(this.sessionPath, 'utf8');
      logger.info('Encrypted session loaded successfully');
    } catch (error) {
      logger.warn({ error }, 'Failed to load encrypted session, will create new');
    }
  }

  async loadSession(client: any): Promise<void> {
    const sessionFile = join(process.cwd(), '.telegram-session');

    if (existsSync(sessionFile)) {
      await client.connect();
      logger.info('Session file loaded and client connected');
    }
  }

  async saveSession(client: any): Promise<void> {
    const session = client.session.serialize();
    const encrypted = await this.encryptSession(session);
    writeFileSync(this.sessionPath, encrypted, { encoding: 'utf8' });
    logger.info('Session saved successfully');
  }

  private async encryptSession(session: string): Promise<string> {
    const crypto = require('crypto');
    const key = this.sessionKey;
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from('telegram-monitor-session'));

    const encrypted = Buffer.concat([cipher.update(session, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    const result = Buffer.concat([iv, tag, encrypted]);

    return result.toString('base64');
  }
}