import express from 'express';
import { z } from 'zod';
import { DatabaseService } from '@db/service.js';
import { logger } from '../utils/logger.js';
import { AuthMiddleware } from '../middleware/auth.js';

const router = express.Router();
const databaseService = new DatabaseService();

const webhookCreateSchema = z.object({
  channelId: z.string().transform(val => parseInt(val)),
  url: z.string().url(),
  secret: z.string(),
  events: z.string().optional(),
  isActive: z.string().transform(val => val === 'true').optional(),
});

router.post('/', AuthMiddleware.protectedRoutes, async (req, res) => {
  try {
    const data = webhookCreateSchema.parse(req.body);

    const webhook = await databaseService.webhook.create(data);

    res.status(201).json(webhook);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    logger.error({ error }, 'Failed to create webhook');
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

router.get('/', AuthMiddleware.protectedRoutes, async (req, res) => {
  try {
    const webhooks = await databaseService.webhook.findAll();
    res.json(webhooks);
  } catch (error) {
    logger.error({ error }, 'Failed to get webhooks');
    res.status(500).json({ error: 'Failed to get webhooks' });
  }
});

router.get('/:id', AuthMiddleware.protectedRoutes, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const webhook = await databaseService.webhook.findById(id);

    if (!webhook) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    res.json(webhook);
  } catch (error) {
    logger.error({ error }, 'Failed to get webhook');
    res.status(500).json({ error: 'Failed to get webhook' });
  }
});

router.delete('/:id', AuthMiddleware.protectedRoutes, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    await databaseService.webhook.update(id, { isActive: false });

    res.status(204).send();
  } catch (error) {
    logger.error({ error }, 'Failed to delete webhook');
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

router.post('/:id/test', AuthMiddleware.protectedRoutes, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const webhook = await databaseService.webhook.findById(id);

    if (!webhook) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }

    res.json({ message: 'Test webhook triggered', webhookId: id });
  } catch (error) {
    logger.error({ error }, 'Failed to test webhook');
    res.status(500).json({ error: 'Failed to test webhook' });
  }
});

export default router;