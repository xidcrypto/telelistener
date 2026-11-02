import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export class QueueService {
  private redis: Redis;
  private messageQueue?: Queue;
  private webhookQueue?: Queue;
  private mediaQueue?: Queue;
  private telegramEventsQueue?: Queue;

  constructor() {
    this.redis = new Redis(config.redisUrl);
    this.redis.on('error', (error) => {
      logger.error({ error }, 'Redis connection error');
    });
  }

  async initialize(): Promise<void> {
    this.messageQueue = new Queue('messages', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });

    this.webhookQueue = new Queue('webhooks', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });

    this.mediaQueue = new Queue('media', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });

    this.telegramEventsQueue = new Queue('telegram-events', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });

    logger.info('Queue service initialized');
  }

  async enqueue(queueName: string, jobData: any): Promise<void> {
    let queue: Queue | undefined;

    switch (queueName) {
      case 'messages':
        queue = this.messageQueue;
        break;
      case 'webhooks':
        queue = this.webhookQueue;
        break;
      case 'media':
        queue = this.mediaQueue;
        break;
      case 'telegram-events':
        queue = this.telegramEventsQueue;
        break;
    }

    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    await queue.add('job', jobData, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }

  async getWebhooksQueueSize(): Promise<number> {
    return this.webhookQueue?.getWaiting().then(jobs => jobs.length) || 0;
  }

  async getMediaQueueSize(): Promise<number> {
    return this.mediaQueue?.getWaiting().then(jobs => jobs.length) || 0;
  }

  async getTotalQueueSize(): Promise<number> {
    const [waitingWebhooks, waitingMedia] = await Promise.all([
      this.webhookQueue?.getWaiting().then(jobs => jobs.length) || 0,
      this.mediaQueue?.getWaiting().then(jobs => jobs.length) || 0,
    ]);

    return waitingWebhooks + waitingMedia;
  }

  async getStatus(): Promise<Record<string, any>> {
    const status: Record<string, any> = {};

    try {
      const waitingMessages = await this.messageQueue?.getWaiting() || [];
      status.messagesQueue = waitingMessages.length;
    } catch (error) {
      status.messagesQueue = 'error';
    }

    try {
      const waitingWebhooks = await this.webhookQueue?.getWaiting() || [];
      status.webhookQueue = waitingWebhooks.length;
    } catch (error) {
      status.webhookQueue = 'error';
    }

    try {
      const waitingMedia = await this.mediaQueue?.getWaiting() || [];
      status.mediaQueue = waitingMedia.length;
    } catch (error) {
      status.mediaQueue = 'error';
    }

    try {
      status.redis = await this.redis.ping();
    } catch (error) {
      status.redis = 'error';
    }

    return status;
  }

  async close(): Promise<void> {
    if (this.messageQueue) {
      await this.messageQueue.close();
    }
    if (this.webhookQueue) {
      await this.webhookQueue.close();
    }
    if (this.mediaQueue) {
      await this.mediaQueue.close();
    }
    if (this.telegramEventsQueue) {
      await this.telegramEventsQueue.close();
    }

    await this.redis.quit();

    logger.info('Queue service closed');
  }
}