import express from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { AuthMiddleware } from '../middleware/auth.js';

const router = express.Router();

const wsTicketSchema = z.object({
  ttl: z.string().transform(val => val ? parseInt(val) : 30).optional(),
  channels: z.string().optional(),
});

router.post('/ws-ticket', async (req, res) => {
  try {
    const data = wsTicketSchema.parse(req.body);

    const ticket = {
      token: `ws_token_${Math.random().toString(36).substring(2, 32)}`,
      ttl: data.ttl || 30,
      channels: data.channels ? data.channels.split(',') : [],
      createdAt: new Date().toISOString(),
    };

    res.json(ticket);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    logger.error({ error }, 'Failed to generate WS ticket');
    res.status(500).json({ error: 'Failed to generate WS ticket' });
  }
});

export default router;