import express, { Request, Response } from 'express';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export class SSEManager {
  public router = express.Router();
  private connections: Map<string, { res: Response; lastEventId?: string }> = new Map();

  constructor() {
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.get('/api/v1/stream', this.streamHandler.bind(this));
  }

  private streamHandler(req: Request, res: Response): void {
    if (!this.validateOrigin(req.headers.origin || '')) {
      res.status(403).json({ error: 'Origin not allowed' });
      return;
    }

    const clientId = this.generateId();

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    res.write('');

    this.connections.set(clientId, { res, lastEventId: req.headers['last-event-id'] as string });

    req.on('close', () => {
      this.handleDisconnect(clientId);
    });

    req.on('error', () => {
      this.handleDisconnect(clientId);
    });

    this.sendInitialMessage(clientId);

    logger.info({ clientId, origin: req.headers.origin }, 'SSE client connected');
  }

  private validateOrigin(origin: string): boolean {
    if (config.cors.allowedOrigins.includes('*')) {
      return true;
    }

    return config.cors.allowedOrigins.some(allowedOrigin =>
      origin.startsWith(allowedOrigin.replace(/\*\.[^./]*\./, '*.'))
    );
  }

  private generateId(): string {
    return `sse_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
  }

  private handleDisconnect(clientId: string): void {
    const connection = this.connections.get(clientId);
    if (connection) {
      connection.res.end();
      this.connections.delete(clientId);

      logger.info({ clientId }, 'SSE client disconnected');
    }
  }

  private sendInitialMessage(clientId: string): void {
    const connection = this.connections.get(clientId);
    if (!connection) {
      return;
    }

    connection.res.write(`data: ${JSON.stringify({
      type: 'connected',
      clientId,
      timestamp: new Date().toISOString(),
    })}\n\n`);
  }

  public async broadcast(event: any): Promise<void> {
    const message = `id: ${event.id || Date.now()}\ndata: ${JSON.stringify(event)}\n\n`;

    for (const [clientId, connection] of this.connections) {
      if (connection.res.writable) {
        try {
          connection.res.write(message);
        } catch (error) {
          logger.error({ error, clientId }, 'Failed to send SSE message');
          this.handleDisconnect(clientId);
        }
      }
    }
  }

  async closeAllConnections(): Promise<void> {
    for (const [clientId, connection] of this.connections) {
      connection.res.end();
    }

    this.connections.clear();

    logger.info('All SSE connections closed');
  }
}