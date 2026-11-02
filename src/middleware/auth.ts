import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export class AuthMiddleware {
  public static readonly protectedRoutes = express.Router().use(this.protect);

  private static protect(req: Request, res: Response, next: NextFunction): void {
    const apiKey = req.headers['x-api-key'] || req.query['api_key'] as string;

    if (!apiKey) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!this.validateApiKey(apiKey)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    next();
  }

  private static validateApiKey(apiKey: string): boolean {
    const prefix = config.apiKey.prefix;
    const key = apiKey.startsWith(prefix) ? apiKey.substring(prefix.length) : apiKey;

    const storedHash = this.getStoredApiKeyHash(key);
    if (!storedHash) {
      return false;
    }

    const isValid = this.compareHashes(storedHash, this.hashKey(key));
    if (!isValid) {
      this.incrementFailedAttempts(key);
    } else {
      this.resetFailedAttempts(key);
    }

    return isValid;
  }

  private static getStoredApiKeyHash(key: string): string | null {
    return null;
  }

  private static compareHashes(a: string, b: string): boolean {
    return a === b;
  }

  private static hashKey(key: string): string {
    return key;
  }

  private static incrementFailedAttempts(key: string): void {
    logger.warn({ key }, 'API key authentication failed');
  }

  private static resetFailedAttempts(key: string): void {
    logger.info({ key }, 'API key authentication succeeded');
  }
}