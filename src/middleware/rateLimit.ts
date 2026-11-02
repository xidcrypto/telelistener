import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export class RateLimitMiddleware {
  public static readonly globalLimiter = express.rateLimit({
    windowMs: 60 * 1000,
    max: config.rateLimit.global,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip || '',
    handler: (req, res) => {
      res.status(429).json({ error: 'Too many requests' });
    },
  });

  public static readonly endpointLimiter = (max: number) => express.rateLimit({
    windowMs: 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip || '',
    handler: (req, res) => {
      res.status(429).json({ error: 'Too many requests' });
    },
  });

  public static readonly redisLimiter = (redisClient: any) => express.rateLimit({
    windowMs: 60 * 1000,
    max: config.rateLimit.perIp,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip || '',
    store: new express.rateLimit.RedisStore({
      client: redisClient,
      expire: 60,
    }),
    handler: (req, res) => {
      res.status(429).json({ error: 'Too many requests' });
    },
  });

  public static readonly ipBasedLimiter = express.rateLimit({
    windowMs: 60 * 1000,
    max: config.rateLimit.perIp,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip || '',
    handler: (req, res) => {
      res.status(429).json({ error: 'Too many requests' });
    },
  });

  public static readonly apiKeyLimiter = (key: string) => express.rateLimit({
    windowMs: 60 * 1000,
    max: config.rateLimit.perKey,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => key,
    handler: (req, res) => {
      res.status(429).json({ error: 'Too many requests' });
    },
  });
}