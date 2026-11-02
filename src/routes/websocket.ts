import express from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { AuthMiddleware } from '../middleware/auth.js';

const router = express.Router();

const wsSubscribeSchema = z.object({
  action: z.literal('subscribe'),
  channels: z.array(z.string()),
  filter: z.object({
    keyword: z.array(z.string()),
    hashtag: z.array(z.string()),
    hasLink: z.boolean(),
  }).optional(),
});

router.ws('/ws', (ws, req) => {
  const query = new URLSearchParams(req.url.substring(1));
  const token = query.get('token') || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    ws.close(401, 'Unauthorized');
    return;
  }

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.action === 'subscribe') {
        wsSubscribeSchema.parse(message);

        ws.send(JSON.stringify({
          type: 'subscribed',
          channels: message.channels,
        }));
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Validation error',
          details: error.errors,
        }));
        return;
      }

      ws.send(JSON.stringify({
        type: 'error',
        error: 'Invalid message format',
      }));
    }
  });

  ws.on('close', () => {
    logger.info('WebSocket connection closed');
  });

  ws.on('error', (error) => {
    logger.error({ error }, 'WebSocket error');
  });
});

export default router;