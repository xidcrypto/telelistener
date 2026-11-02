import express from 'express';
import { z } from 'zod';
import { DatabaseService } from '@db/service.js';
import { logger } from '../utils/logger.js';
import { AuthMiddleware } from '../middleware/auth.js';

const router = express.Router();
const databaseService = new DatabaseService();

const messageQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.string().transform(val => val ? parseInt(val) : 50).optional(),
  fromDate: z.string().transform(val => val ? new Date(val) : undefined).optional(),
  toDate: z.string().transform(val => val ? new Date(val) : undefined).optional(),
  search: z.string().optional(),
  hashtags: z.string().transform(val => val ? val.split(',') : []).optional(),
  hasLink: z.string().transform(val => val === 'true').optional(),
  includeDeleted: z.string().transform(val => val === 'true').optional(),
});

router.get('/channels/:id/messages', AuthMiddleware.protectedRoutes, async (req, res) => {
  try {
    const channelId = parseInt(req.params.id);
    const query = messageQuerySchema.parse(req.query);

    const result = await databaseService.message.findByChannel(channelId, query);

    res.json({
      messages: result.messages,
      hasMore: result.hasMore,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    logger.error({ error }, 'Failed to get messages');
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

router.get('/messages/:id', AuthMiddleware.protectedRoutes, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const message = await databaseService.message.findById(id);

    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    res.json(message);
  } catch (error) {
    logger.error({ error }, 'Failed to get message');
    res.status(500).json({ error: 'Failed to get message' });
  }
});

router.get('/messages/:id/revisions', AuthMiddleware.protectedRoutes, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const revisions = await databaseService.revision.findByMessageId(id);

    res.json(revisions);
  } catch (error) {
    logger.error({ error }, 'Failed to get message revisions');
    res.status(500).json({ error: 'Failed to get message revisions' });
  }
});

router.get('/media/:id', AuthMiddleware.protectedRoutes, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const media = await databaseService.media.findById(id);

    if (!media) {
      res.status(404).json({ error: 'Media not found' });
      return;
    }

    res.setHeader('Content-Disposition', `attachment; filename="${media.file_name}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(media.stored_path);
  } catch (error) {
    logger.error({ error }, 'Failed to get media');
    res.status(500).json({ error: 'Failed to get media' });
  }
});

export default router;