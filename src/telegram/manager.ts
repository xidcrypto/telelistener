import { TelegramClient } from 'telegram';
import { NewMessage, EditedMessage, DeletedMessage } from 'telegram/builtins';
import { Message as TelegramMessage, User as TelegramUser, Chat as TelegramChat } from '@telegram.ts/types';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { DatabaseService } from '@db/service.js';
import { QueueService } from '@queue/service.js';
import { extractUrls, extractHashtags } from '../utils/parsers.js';
import { SessionManager } from '../utils/session.js';
import { MediaProcessor } from '../services/media.js';
import { EventEmitter } from 'events';

export class TelegramManager extends EventEmitter {
  private client?: TelegramClient;
  private sessionManager?: SessionManager;
  private databaseService: DatabaseService;
  private queueService: QueueService;
  private mediaProcessor: MediaProcessor;
  private reconnectTimeout?: NodeJS.Timeout;
  private watchdogTimeout?: NodeJS.Timeout;
  private isConnecting: boolean = false;
  private lastHeartbeat: Date = new Date();
  private channelId?: number;

  constructor() {
    super();
    this.databaseService = new DatabaseService();
    this.queueService = new QueueService();
    this.mediaProcessor = new MediaProcessor(config.telegram.mediaDownloadDir, config.telegram.mimeWhitelist, config.telegram.maxMediaSizeBytes);
  }

  async initialize(channelUsername: string): Promise<void> {
    await this.databaseService.initialize();
    await this.queueService.initialize();

    this.sessionManager = new SessionManager(config.telegram.sessionEncKey);
    await this.sessionManager.initialize();

    this.client = new TelegramClient(
      {
        apiId: config.telegram.apiId,
        apiHash: config.telegram.apiHash,
        phoneNumber: config.telegram.phoneNumber,
      },
      {
        connection: {
          maxRetries: 3,
          retryDelay: 1000,
          useWSS: true,
          useAdaptiveReconnect: true,
          maxWaitTimeMs: 10000,
        },
        limit: {
          fileSize: config.telegram.maxMediaSizeBytes / (1024 * 1024),
        },
      }
    );

    this.setupEventHandlers();

    try {
      await this.connect();

      await this.resolveChannel(channelUsername);

      this.startWatchdog();

      logger.info({ channel: channelUsername }, 'Telegram manager initialized');
    } catch (error) {
      logger.error({ error, channel: channelUsername }, 'Failed to initialize Telegram manager');
      throw error;
    }
  }

  async connect(): Promise<void> {
    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      await this.sessionManager!.loadSession(this.client!);

      this.client!.addEventHandler(this.onNewMessage.bind(this), NewMessage());
      this.client!.addEventHandler(this.onEditedMessage.bind(this), EditedMessage());
      this.client!.addEventHandler(this.onDeletedMessage.bind(this), DeletedMessage());

      await this.client!.connect();

      this.updateHeartbeat();

      this.lastHeartbeat = new Date();

      logger.info('Telegram client connected');
    } catch (error) {
      logger.error({ error }, 'Failed to connect to Telegram');
      this.scheduleReconnect();
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  private async resolveChannel(channelUsername: string): Promise<void> {
    try {
      const channel = await this.client!.invoke(
        new this.client!.apis.channels.GetFullChannel({ channel: channelUsername })
      );

      const telegramChannel = channel.fullChat as TelegramChat;
      const channelId = await this.databaseService.channel.create({
        telegram_channel_id: telegramChannel.id,
        username: telegramChannel.username,
        title: telegramChannel.title,
        is_forum: telegramChannel.forum || false,
        is_verified: telegramChannel.verified || false,
        member_count: telegramChannel.participantsCount,
        description: telegramChannel.about,
        is_active: true,
      });

      this.channelId = channelId.id;

      logger.info({ channelId: this.channelId, channelUsername }, 'Channel resolved and saved');
    } catch (error) {
      logger.error({ error, channelUsername }, 'Failed to resolve channel');
      throw error;
    }
  }

  async joinChannel(channelUsername: string): Promise<void> {
    try {
      await this.client!.invoke(new this.client!.apis.channels.JoinChannel({ channel: channelUsername }));

      logger.info({ channelUsername }, 'Joined channel successfully');
    } catch (error) {
      logger.error({ error, channelUsername }, 'Failed to join channel');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.watchdogTimeout) {
      clearTimeout(this.watchdogTimeout);
    }

    if (this.client?.isConnected) {
      await this.client.disconnect();
    }

    logger.info('Telegram client disconnected');
  }

  private onNewMessage(event: NewMessage.Event): void {
    this.updateHeartbeat();
    this.queueService.enqueue('telegram-events', {
      type: 'new',
      data: event,
      timestamp: new Date(),
    });
  }

  private onEditedMessage(event: EditedMessage.Event): void {
    this.updateHeartbeat();
    this.queueService.enqueue('telegram-events', {
      type: 'edit',
      data: event,
      timestamp: new Date(),
    });
  }

  private onDeletedMessage(event: DeletedMessage.Event): void {
    this.updateHeartbeat();
    this.queueService.enqueue('telegram-events', {
      type: 'delete',
      data: event,
      timestamp: new Date(),
    });
  }

  private startWatchdog(): void {
    const watchdogInterval = 5 * 60 * 1000;

    const checkWatchdog = async () => {
      const now = new Date();
      const timeSinceHeartbeat = now.getTime() - this.lastHeartbeat.getTime();

      if (timeSinceHeartbeat > config.operational.heartbeatTimeoutMs) {
        logger.warn({ timeSinceHeartbeat }, 'Telegram heartbeat timeout - reconnecting');
        await this.disconnect();
        this.scheduleReconnect();
        return;
      }

      this.watchdogTimeout = setTimeout(checkWatchdog, watchdogInterval);
    };

    this.watchdogTimeout = setTimeout(checkWatchdog, watchdogInterval);
  }

  private updateHeartbeat(): void {
    this.lastHeartbeat = new Date();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      return;
    }

    const backoff = this.getReconnectBackoff();
    logger.info({ backoff }, 'Scheduling reconnect');

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = undefined;
      this.connect().catch((error) => {
        logger.error({ error }, 'Reconnect failed');
        this.scheduleReconnect();
      });
    }, backoff);
  }

  private getReconnectBackoff(): number {
    const baseDelay = 1000;
    const maxDelay = config.operational.reconnectBackoffMaxMs;
    const attempt = this.getReconnectAttempt();
    const delay = Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 1000, maxDelay);

    return delay;
  }

  private getReconnectAttempt(): number {
    return parseInt(process.env.TELEGRAM_RECONNECT_ATTEMPT || '0', 10);
  }

  private setupEventHandlers(): void {
    this.client?.addEventHandler(this.handleTelegramError.bind(this), this.client!.addEvents.Error);
    this.client?.addEventHandler(this.handleFloodWait.bind(this), this.client!.addEvents.FloodWait);
    this.client?.addEventHandler(this.handleAuthKeyUnregistered.bind(this), this.client!.addEvents.AuthKeyUnregistered);
    this.client?.addEventHandler(this.handleSessionRevoked.bind(this), this.client!.addEvents.SessionRevoked);
    this.client?.addEventHandler(this.handleUserDeactivated.bind(this), this.client!.addEvents.UserDeactivated);
  }

  private handleTelegramError(error: any): void {
    logger.error({ error }, 'Telegram error occurred');

    if (error.code === -1001 || error.message.includes('CHANNEL_PRIVATE')) {
      logger.error('Channel is private or user not a member');
      process.exit(1);
    }
  }

  private handleFloodWait(event: any): void {
    const waitTime = event.seconds || 5;
    logger.warn({ waitTime }, 'Flood wait, waiting to resume');

    setTimeout(() => {
      this.connect().catch((error) => {
        logger.error({ error }, 'Failed to resume after flood wait');
      });
    }, waitTime * 1000);
  }

  private handleAuthKeyUnregistered(): void {
    logger.error('Authentication key unregistered - stopping');
    this.stop();
  }

  private handleSessionRevoked(): void {
    logger.error('Session revoked - stopping');
    this.stop();
  }

  private handleUserDeactivated(): void {
    logger.error('User deactivated - stopping');
    this.stop();
  }

  async stop(): Promise<void> {
    logger.info('Stopping Telegram manager');

    await this.disconnect();

    this.removeAllListeners();

    logger.info('Telegram manager stopped');
  }

  async backfill(channelId: number, count: number): Promise<void> {
    try {
      const channel = await this.databaseService.channel.findById(channelId);
      const username = channel.username;

      const result = await this.client!.invoke(
        new this.client!.apis.messages.GetHistory({
          peer: username,
          limit: count,
          offsetId: 0,
        })
      );

      for (const message of result.messages.reverse()) {
        await this.processMessage(message, channelId);
      }

      logger.info({ count, channelId }, 'Backfill completed');
    } catch (error) {
      logger.error({ error, channelId }, 'Backfill failed');
    }
  }

  private async processMessage(message: any, channelId: number): Promise<void> {
    const existing = await this.databaseService.message.findByTelegramIds(
      message.chat.id,
      message.id
    );

    if (existing) {
      return;
    }

    const parsedText = message.message || '';

    const urls = extractUrls(parsedText);
    const hashtags = extractHashtags(parsedText);

    const telegramMessage = message as TelegramMessage;
    const telegramSender = telegramMessage.senderId ? (await this.client!.invoke(
      new this.client!.apis.users.GetFullUser({ userId: telegramMessage.senderId })
    )).user as TelegramUser : undefined;

    const dbMessage = {
      channel_id: channelId,
      telegram_message_id: message.id,
      telegram_chat_id: message.chat.id,
      sender_id: telegramSender?.id,
      sender_username: telegramSender?.username,
      sender_first_name: telegramSender?.firstName,
      sender_last_name: telegramSender?.lastName,
      message: message.message || '',
      parsed_text: parsedText,
      entities: telegramMessage.entities || [],
      raw_json: JSON.stringify({
        message: telegramMessage,
        raw: message,
      }),
      created_at: new Date(telegramMessage.date * 1000),
      edited_at: telegramMessage.editDate ? new Date(telegramMessage.editDate * 1000) : null,
      views: telegramMessage.views || 0,
      forwards: telegramMessage.forwards || 0,
      reply_to_id: telegramMessage.replyToMsgId,
      grouped_id: telegramMessage.groupedId,
      media_info: telegramMessage.media,
      is_deleted: false,
      deleted_at: null,
    };

    const savedMessage = await this.databaseService.message.create(dbMessage);

    if (urls.length > 0) {
      await Promise.all(
        urls.map(url =>
          this.databaseService.urls.create({
            message_id: savedMessage.id,
            url: url.url,
            normalized_url: url.normalized,
            is_shortener: url.isShortener,
          })
        )
      );
    }

    if (hashtags.length > 0) {
      await Promise.all(
        hashtags.map(hashtag =>
          this.databaseService.hashtags.create({
            message_id: savedMessage.id,
            hashtag: hashtag,
          })
        )
      );
    }

    if (telegramMessage.media && telegramMessage.media.length > 0) {
      await this.mediaProcessor.processMedia(telegramMessage, savedMessage.id, this.client!, channelId);
    }

    await this.queueService.enqueue('messages', {
      type: 'new',
      messageId: savedMessage.id,
      channelId: channelId,
    });

    this.emit('message.new', savedMessage);
  }

  async checkConnection(): Promise<{ status: string; error?: string }> {
    try {
      if (this.client?.isConnected) {
        await this.client.getMe();
        return { status: 'ok' };
      } else {
        return { status: 'error', error: 'Client not connected' };
      }
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getStatus(): Promise<Record<string, any>> {
    const status: Record<string, any> = {
      connected: this.client?.isConnected || false,
      lastActivity: this.lastHeartbeat.toISOString(),
      lastMessageTime: null,
      state: null,
    };

    if (this.channelId) {
      try {
        const latestMessage = await this.databaseService.message.findByChannel(this.channelId, {
          limit: 1,
        });
        if (latestMessage.messages.length > 0) {
          status.lastMessageTime = latestMessage.messages[0].created_at;
        }
      } catch (error) {
        logger.error({ error }, 'Failed to get last message time');
      }
    }

    try {
      const { rows } = await this.client!.invoke(
        new this.client!.apis.account.GetAuthorizations()
      );
      status.state = rows.length > 0 ? 'active' : 'inactive';
    } catch (error) {
      status.state = 'error';
    }

    return status;
  }
}
