import express from 'express';
import { z } from 'zod';
import { DatabaseService } from '@db/service.js';
import { logger } from '../utils/logger.js';
import { AuthMiddleware } from '../middleware/auth.js';

const router = express.Router();
const databaseService = new DatabaseService();

const channelCreateSchema = z.object({
  telegramChannelId: z.string(),
  username: z.string().optional(),
  title: z.string(),
  isForum: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  memberCount: z.number().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

const channelUpdateSchema = z.object({
  telegramChannelId: z.string().optional(),
  username: z.string().optional(),
  title: z.string().optional(),
  isForum: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  memberCount: z.number().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
}).partial();

router.post('/', AuthMiddleware.protectedRoutes, async (req, res) => {
  try {
    const data = channelCreateSchema.parse(req.body);

    const channel = await databaseService.channel.create(data);

    res.status(201).json(channel);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    logger.error({ error }, 'Failed to create channel');
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

router.get('/', AuthMiddleware.protectedRoutes, async (req, res) => {
  try {
    const channels = await databaseService.channel.getAll();
    res.json(channels);
  } catch (error) {
    logger.error({ error }, 'Failed to get channels');
    res.status(500).json({ error: 'Failed to get channels' });
  }
});

router.get('/:id', AuthMiddleware.protectedRoutes, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const channel = await databaseService.channel.findById(id);

    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    res.json(channel);
  } catch (error) {
    logger.error({ error }, 'Failed to get channel');
    res.status(500).json({ error: 'Failed to get channel' });
  }
});

router.patch('/:id', AuthMiddleware.protectedRoutes, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = channelUpdateSchema.parse(req.body);

    const channel = await databaseService.channel.update(id, data);

    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    res.json(channel);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    logger.error({ error }, 'Failed to update channel');
    res.status(500).json({ error: 'Failed to update channel' });
  }
});

router.delete('/:id', AuthMiddleware.protectedRoutes, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    await databaseService.channel.update(id, { isActive: false });

    res.status(204).send();
  } catch (error) {
    logger.error({ error }, 'Failed to delete channel');
    res.status(500).json({ error: 'Failed to delete channel' });
  }
});

export default router;