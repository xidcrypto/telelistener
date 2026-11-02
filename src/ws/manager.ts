import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { DatabaseService } from '@db/service.js';
import { generateId } from '../utils/logger.js';

export class WebSocketManager {
  private wss?: WebSocket.Server;
  private clients: Map<string, WebSocket> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map();
  private buffers: Map<string, any[]> = new Map();
  private redis?: any;
  private databaseService: DatabaseService;

  constructor(wss: WebSocket.Server, databaseService: DatabaseService) {
    this.wss = wss;
    this.databaseService = databaseService;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.wss?.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const clientId = generateId();
      const origin = req.headers.origin || '';
      const userAgent = req.headers['user-agent'] || '';

      if (!this.validateOrigin(origin)) {
        ws.close(403, 'Origin not allowed');
        return;
      }

      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleClientMessage(clientId, message, ws);
        } catch (error) {
          logger.error({ error }, 'Failed to parse WebSocket message');
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Invalid message format',
          }));
        }
      });

      ws.on('close', () => {
        this.handleClientDisconnect(clientId);
      });

      ws.on('error', (error) => {
        logger.error({ error, clientId }, 'WebSocket error');
        this.handleClientDisconnect(clientId);
      });

      this.clients.set(clientId, ws);
      this.buffers.set(clientId, []);
      this.subscriptions.set(clientId, new Set());

      logger.info({ clientId, origin, userAgent }, 'WebSocket client connected');
    });
  }

  private validateOrigin(origin: string): boolean {
    if (config.cors.allowedOrigins.includes('*')) {
      return true;
    }

    return config.cors.allowedOrigins.some(allowedOrigin =>
      origin.startsWith(allowedOrigin.replace(/\*\.[^./]*\./, '*.'))
    );
  }

  private async handleClientMessage(clientId: string, message: any, ws: WebSocket): Promise<void> {
    switch (message.action) {
      case 'subscribe':
        await this.handleSubscribe(clientId, message.channels, message.filter);
        break;
      case 'unsubscribe':
        await this.handleUnsubscribe(clientId, message.channels);
        break;
      case 'ping':
        ws.send(JSON.stringify({
          type: 'pong',
          timestamp: new Date().toISOString(),
        }));
        break;
    }
  }

  private async handleSubscribe(clientId: string, channels: string[], filter: any): Promise<void> {
    const ws = this.clients.get(clientId);
    if (!ws) {
      return;
    }

    for (const channel of channels) {
      this.subscriptions.get(clientId)?.add(channel);
    }

    const channelsStr = Array.from(this.subscriptions.get(clientId) || []).join(', ');
    ws.send(JSON.stringify({
      type: 'subscribed',
      channels: channelsStr,
    }));
  }

  private async handleUnsubscribe(clientId: string, channels: string[]): Promise<void> {
    const ws = this.clients.get(clientId);
    if (!ws) {
      return;
    }

    for (const channel of channels) {
      this.subscriptions.get(clientId)?.delete(channel);
    }

    ws.send(JSON.stringify({
      type: 'unsubscribed',
    }));
  }

  private handleClientDisconnect(clientId: string): void {
    this.clients.delete(clientId);
    this.buffers.delete(clientId);
    this.subscriptions.delete(clientId);

    logger.info({ clientId }, 'WebSocket client disconnected');
  }

  async publish(channelId: number, event: any): Promise<void> {
    const channelUsername = await this.databaseService.channel.findById(channelId);
    if (!channelUsername) {
      return;
    }

    const channelKey = channelUsername.username;
    const payload = JSON.stringify({
      type: event.type,
      data: event.data,
      seq: event.seq,
    });

    for (const [clientId, ws] of this.clients) {
      if (ws.readyState !== WebSocket.OPEN) {
        continue;
      }

      const clientChannels = this.subscriptions.get(clientId);
      if (!clientChannels || !clientChannels.has(channelKey)) {
        continue;
      }

      try {
        ws.send(payload);
      } catch (error) {
        logger.error({ error, clientId }, 'Failed to send WebSocket message');
        this.handleClientDisconnect(clientId);
      }
    }
  }

  async getStatus(): Promise<Record<string, any>> {
    const status: Record<string, any> = {
      clients: this.clients.size,
      activeSubscriptions: Array.from(this.subscriptions.values()).reduce((sum, set) => sum + set.size, 0),
    };

    return status;
  }

  async closeAllConnections(): Promise<void> {
    for (const [clientId, ws] of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Server shutting down');
      }
    }

    this.clients.clear();
    this.subscriptions.clear();
    this.buffers.clear();

    logger.info('All WebSocket connections closed');
  }
}