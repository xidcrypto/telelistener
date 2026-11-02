import express, { Express } from 'express';
import { Server } from 'http';
import { WebSocketServer } from 'ws';
import { PinoHttpOptions, pino } from 'pino';
import { pinoHttp } from 'pino-http';
import { ZodError } from 'zod';
import { WebSocketManager } from '@ws/manager.js';
import { TelegramManager } from '@telegram/manager.js';
import { DatabaseService } from '@db/service.js';
import { QueueService } from '@queue/service.js';
import { AuthMiddleware } from '@middleware/auth.js';
import { ErrorHandler } from '@middleware/error.js';
import { RateLimitMiddleware } from '@middleware/rateLimit.js';
import { SSEManager } from '@ws/sse.js';
import { OpenAPIHandler } from '@routes/openapi.js';
import { logger, generateRequestId } from '@utils/logger.js';
import { config } from '@config/index.js';

export class App {
  private app: Express;
  private server?: Server;
  private wss?: WebSocketServer;
  private telegramManager?: TelegramManager;
  private websocketManager?: WebSocketManager;
  private sseManager?: SSEManager;
  private databaseService?: DatabaseService;
  private queueService?: QueueService;
  private openAPIHandler?: OpenAPIHandler;

  public async initialize(): Promise<void> {
    this.app = express();

    this.configureMiddleware();
    await this.configureServices();
    this.configureRoutes();
    this.configureWebSocket();
    this.configureSSE();
    this.configureOpenAPI();
    this.configureHealthChecks();
    this.configureObservability();

    this.server = this.app.listen(0, '0.0.0.0');

    await this.startTelegramListener();

    logger.info('Application initialized successfully');
  }

  public get express(): Express {
    return this.app;
  }

  public get serverInstance(): Server | undefined {
    return this.server;
  }

  public async gracefulShutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'Received shutdown signal');

    if (this.server) {
      this.server.close(async () => {
        logger.info('HTTP server closed');

        await this.cleanup();

        process.exit(0);
      });

      await new Promise<void>((resolve) => {
        setTimeout(() => {
          logger.warn('Force shutdown');
          process.exit(1);
        }, config.shutdownTimeout);
        this.server?.closeAllConnections?.();
      });
    }

    await this.cleanup();
  }

  private configureMiddleware(): void {
    this.app.use(generateRequestId);
    this.app.use(express.json({ limit: config.bodyLimit }));
    this.app.use(express.urlencoded({ extended: true, limit: config.bodyLimit }));

    const httpLogger = pinoHttp({
      logger,
      genReqId: (req) => req.id,
      useLevel: 'info',
      levelFilter: ['info', 'warn', 'error'],
      customLogLevel: (res, error) => {
        if (res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      customSuccessMessage: (req, res) => {
        return `${req.method} ${req.url} completed in ${res.getHeader('X-Response-Time') as number}ms`;
      },
      customErrorMessage: (req, res, error) => {
        return `${req.method} ${req.url} errored with ${error.statusCode}`;
      },
      hideStackTrace: true,
    } as PinoHttpOptions);

    this.app.use(httpLogger);

    this.app.use(AuthMiddleware.protectedRoutes);
    this.app.use(RateLimitMiddleware.globalLimiter);
    this.app.use(ErrorHandler.handler);

    if (config.cors.allowedOrigins.length > 0) {
      this.app.use(cors({
        origin: config.cors.allowedOrigins,
        credentials: false,
        maxAge: config.cors.maxAge,
        exposedHeaders: config.cors.exposedHeaders,
      }));
    }

    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          workerSrc: ["'self'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      noSniff: true,
      xssFilter: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }));

    this.app.disable('x-powered-by');

    const proxyCount = config.trustProxy ? Number(process.env.TRUST_PROXY_COUNT || 1) : 0;
    this.app.set('trust proxy', proxyCount);
  }

  private async configureServices(): Promise<void> {
    this.databaseService = new DatabaseService();
    await this.databaseService.initialize();

    this.queueService = new QueueService();
    await this.queueService.initialize();
  }

  private configureRoutes(): void {
    this.app.use('/api/v1', AuthMiddleware.protectedRoutes);

    this.app.get('/api/v1/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    this.app.get('/api/v1/ready', async (req, res) => {
      try {
        const ready = await this.checkReady();
        res.json({
          status: 'ready',
          checks: ready,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        res.status(503).json({
          status: 'not ready',
          error: 'Service not ready',
          timestamp: new Date().toISOString(),
        });
      }
    });

    this.app.get('/api/v1/status', AuthMiddleware.protectedRoutes, async (req, res) => {
      const status = await this.getStatus();
      res.json(status);
    });

    this.app.use('/api/v1', (await import('@routes/channels.js')).default);
    this.app.use('/api/v1', (await import('@routes/messages.js')).default);
    this.app.use('/api/v1', (await import('@routes/media.js')).default);
    this.app.use('/api/v1', (await import('@routes/webhooks.js')).default);
    this.app.use('/api/v1', (await import('@routes/websocket.js')).default);
    this.app.use('/api/v1', (await import('@routes/ws-ticket.js')).default);
  }

  private configureWebSocket(): void {
    this.wss = new WebSocketServer({
      server: this.server,
      maxPayload: config.ws.maxPayload,
    });

    this.websocketManager = new WebSocketManager(this.wss, this.databaseService!);
  }

  private configureSSE(): void {
    this.sseManager = new SSEManager();
    this.app.use('/api/v1/stream', this.sseManager.router);
  }

  private configureOpenAPI(): void {
    if (!config.production) {
      this.openAPIHandler = new OpenAPIHandler();
      this.app.use('/docs', this.openAPIHandler.router);
    }
  }

  private configureHealthChecks(): void {
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });
  }

  private configureObservability(): void {
    if (config.metrics.enabled) {
      this.app.get('/metrics', AuthMiddleware.protectedRoutes, async (req, res) => {
        if (config.metrics.prometheusAuthToken && req.headers.authorization !== `Bearer ${config.metrics.prometheusAuthToken}`) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }

        res.set('Content-Type', 'text/plain; version=0.0.4');
        res.send(await import('@utils/metrics.js').then(m => m.prometheusMetrics()));
      });
    }
  }

  private async startTelegramListener(): Promise<void> {
    try {
      this.telegramManager = new TelegramManager();
      await this.telegramManager.initialize(config.telegram.channelUsername);

      logger.info({ channel: config.telegram.channelUsername }, 'Telegram listener initialized');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Telegram listener');
      throw error;
    }
  }

  private async checkReady(): Promise<Record<string, any>> {
    const checks: Record<string, any> = {};

    try {
      checks.database = await this.databaseService!.checkHealth();
    } catch (error) {
      checks.database = { status: 'error', error: (error as Error).message };
    }

    try {
      checks.redis = await this.queueService!.redis.ping();
    } catch (error) {
      checks.redis = { status: 'error', error: (error as Error).message };
    }

    try {
      checks.telegram = await this.telegramManager!.checkConnection();
    } catch (error) {
      checks.telegram = { status: 'error', error: (error as Error).message };
    }

    const allReady = Object.values(checks).every(check => check.status === 'ok');

    return {
      ready: allReady,
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  private async getStatus(): Promise<Record<string, any>> {
    const status: Record<string, any> = {
      telegram: {
        connected: false,
        lastActivity: null,
        lastMessageTime: null,
        state: null,
      },
      websocket: {
        clients: 0,
        activeSubscriptions: 0,
      },
      queue: {
        webhookQueue: 0,
        mediaDownloadQueue: 0,
        totalPending: 0,
      },
      database: {
        messagesTotal: 0,
        lastMessageTime: null,
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),n
    };

    if (this.telegramManager) {
      status.telegram = await this.telegramManager.getStatus();
    }

    if (this.websocketManager) {
      status.websocket = await this.websocketManager.getStatus();
    }

    if (this.queueService) {
      status.queue = await this.queueService.getStatus();
    }

    if (this.databaseService) {
      status.database = await this.databaseService.getStatus();
    }

    status.timestamp = new Date().toISOString();

    return status;
  }

  private async cleanup(): Promise<void> {
    logger.info('Cleaning up resources');

    if (this.websocketManager) {
      await this.websocketManager.closeAllConnections();
    }

    if (this.sseManager) {
      await this.sseManager.closeAllConnections();
    }

    if (this.telegramManager) {
      await this.telegramManager.stop();
    }

    if (this.queueService) {
      await this.queueService.close();
    }

    if (this.databaseService) {
      await this.databaseService.close();
    }

    logger.info('Cleanup completed');
  }
}