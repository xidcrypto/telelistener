import { z } from 'zod';

const stringToBoolean = (value: string | undefined): boolean => {
  if (value === undefined) return false;
  const lowerValue = value.toLowerCase();
  return lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes';
};

const stringToNumber = (value: string | undefined): number => {
  if (value === undefined) return 0;
  return Number(value);
};

const parseIpRange = (value: string): string => {
  return value.trim();
};

const parseStringArray = (value: string | undefined): string[] => {
  if (!value) return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
};

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(stringToNumber).default(3000),
  HOST: z.string().default('0.0.0.0'),
  TRUST_PROXY: z.string().transform(stringToBoolean).default(false),

  DATABASE_URL: z.string(),
  DATABASE_POOL_SIZE: z.string().transform(stringToNumber).default(20),
  SQLITE_PATH: z.string().default('./dev.db'),

  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),

  API_ID: z.string(),
  API_HASH: z.string(),
  PHONE_NUMBER: z.string(),
  SESSION_ENC_KEY: z.string().min(32).max(32),
  CHANNEL_USERNAME: z.string().default('airdropfind'),
  MEDIA_DOWNLOAD_DIR: z.string().default('./media'),
  MAX_MEDIA_SIZE_MB: z.string().transform(stringToNumber).default(100),
  MEDIA_MIME_WHITELIST: z.string().default('image/jpeg,image/png,image/gif,application/pdf,video/mp4,video/quicktime,audio/mpeg,audio/wav'),

  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().default('telegram-monitor'),
  JWT_AUDIENCE: z.string().default('api-client'),
  JWT_EXPIRES_IN: z.string().default('15m'),

  API_KEY_PREFIX: z.string().default('tm_'),
  API_KEY_HASH_ROUNDS: z.string().transform(stringToNumber).default(4),
  API_KEY_CACHE_TTL: z.string().transform(stringToNumber).default(3600),

  RATE_LIMIT_GLOBAL: z.string().transform(stringToNumber).default(1000),
  RATE_LIMIT_PER_IP: z.string().transform(stringToNumber).default(100),
});

envSchema.parse(process.env);

export const config = {
  production: process.env.NODE_ENV === 'production',
  bodyLimit: '100kb',
  trustProxy: process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1',
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : [],
    maxAge: process.env.CORS_MAX_AGE ? Number(process.env.CORS_MAX_AGE) : 600,
    exposedHeaders: process.env.CORS_EXPOSED_HEADERS ? process.env.CORS_EXPOSED_HEADERS.split(',').map(h => h.trim()) : [],
  },
  ssl: {
    certPath: process.env.SSL_CERT_PATH,
    keyPath: process.env.SSL_KEY_PATH,
    ciphers: process.env.SSL_CIPHERS || 'TLS_AES_256_GCM_SHA384:TLS_AES_128_GCM_SHA256:TLS_CHACHA20_POLY1305_SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256',
    minVersion: process.env.SSL_MIN_VERSION || 'TLS1.2',
  },
  telegram: {
    apiId: process.env.API_ID || '',
    apiHash: process.env.API_HASH || '',
    phoneNumber: process.env.PHONE_NUMBER || '',
    sessionEncKey: process.env.SESSION_ENC_KEY || '',
    channelUsername: process.env.CHANNEL_USERNAME || 'airdropfind',
    mediaDownloadDir: process.env.MEDIA_DOWNLOAD_DIR || './media',
    maxMediaSizeBytes: (process.env.MAX_MEDIA_SIZE_MB || '100') * 1024 * 1024,
    mimeWhitelist: process.env.MEDIA_MIME_WHITELIST ? process.env.MEDIA_MIME_WHITELIST.split(',') : ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'video/mp4', 'video/quicktime', 'audio/mpeg', 'audio/wav'],
  },
  jwt: {
    secret: process.env.JWT_SECRET || '',
    issuer: process.env.JWT_ISSUER || 'telegram-monitor',
    audience: process.env.JWT_AUDIENCE || 'api-client',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  },
  apiKey: {
    prefix: process.env.API_KEY_PREFIX || 'tm_',
    hashRounds: process.env.API_KEY_HASH_ROUNDS ? Number(process.env.API_KEY_HASH_ROUNDS) : 4,
    cacheTtl: process.env.API_KEY_CACHE_TTL ? Number(process.env.API_KEY_CACHE_TTL) : 3600,
  },
  rateLimit: {
    global: process.env.RATE_LIMIT_GLOBAL ? Number(process.env.RATE_LIMIT_GLOBAL) : 1000,
    perIp: process.env.RATE_LIMIT_PER_IP ? Number(process.env.RATE_LIMIT_PER_IP) : 100,
    perKey: process.env.RATE_LIMIT_PER_KEY ? Number(process.env.RATE_LIMIT_PER_KEY) : 100,
  },
  ws: {
    maxPayload: process.env.WS_MAX_PAYLOAD ? Number(process.env.WS_MAX_PAYLOAD) : 16384,
    heartbeatInterval: process.env.WS_HEARTBEAT_INTERVAL ? Number(process.env.WS_HEARTBEAT_INTERVAL) : 30000,
    idleTimeout: process.env.WS_IDLE_TIMEOUT ? Number(process.env.WS_IDLE_TIMEOUT) : 300000,
    maxConnectionsPerIp: process.env.WS_MAX_CONNECTIONS_PER_IP ? Number(process.env.WS_MAX_CONNECTIONS_PER_IP) : 100,
    maxConnectionsPerKey: process.env.WS_MAX_CONNECTIONS_PER_KEY ? Number(process.env.WS_MAX_CONNECTIONS_PER_KEY) : 100,
  },
  webhook: {
    maxRetries: process.env.WEBHOOK_MAX_RETRIES ? Number(process.env.WEBHOOK_MAX_RETRIES) : 8,
    retryDelayBase: process.env.WEBHOOK_RETRY_DELAY_BASE ? Number(process.env.WEBHOOK_RETRY_DELAY_BASE) : 1000,
    timeout: process.env.WEBHOOK_TIMEOUT ? Number(process.env.WEBHOOK_TIMEOUT) : 30000,
    maxSize: process.env.WEBHOOK_MAX_SIZE ? Number(process.env.WEBHOOK_MAX_SIZE) : 1000000,
    cacheTtl: process.env.WEBHOOK_CACHE_TTL ? Number(process.env.WEBHOOK_CACHE_TTL) : 3600,
  },
  security: {
    allowedIpRanges: process.env.ALLOWED_IP_RANGES ? process.env.ALLOWED_IP_RANGES.split(',').map(parseIpRange) : [],
    blockedIpRanges: process.env.BLOCKED_IP_RANGES ? process.env.BLOCKED_IP_RANGES.split(',').map(parseIpRange) : [
      '127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '169.254.0.0/16', '::1', 'fc00::/7',
    ],
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    redactionPatterns: process.env.LOG_REDACTION_PATTERNS ? process.env.LOG_REDACTION_PATTERNS.split(',') : ['authorization', 'api_key', 'session', 'phone', 'otp', 'secret'],
    format: process.env.LOG_FORMAT || 'json',
  },
  monitoring: {
    enabled: process.env.METRICS_ENABLED === 'true' || process.env.METRICS_ENABLED === '1',
    port: process.env.METRICS_PORT ? Number(process.env.METRICS_PORT) : 9090,
    prometheusAuthToken: process.env.PROMETHEUS_AUTH_TOKEN,
  },
  operational: {
    shutdownTimeout: process.env.SHUTDOWN_TIMEOUT ? Number(process.env.SHUTDOWN_TIMEOUT) : 30000,
    heartbeatTimeoutMs: process.env.HEARTBEAT_TIMEOUT_MS ? Number(process.env.HEARTBEAT_TIMEOUT_MS) : 300000,
    reconnectBackoffMaxMs: process.env.RECONNECT_BACKOFF_MAX_MS ? Number(process.env.RECONNECT_BACKOFF_MAX_MS) : 60000,
    backfillMessagesN: process.env.BACKFILL_MESSAGES_N ? Number(process.env.BACKFILL_MESSAGES_N) : 100,
    maxMessageEditRevisions: process.env.MAX_MESSAGE_EDIT_REVISIONS ? Number(process.env.MAX_MESSAGE_EDIT_REVISIONS) : 10,
  },
  httpsProxy: {
    url: process.env.HTTPS_PROXY,
    noProxy: process.env.NO_PROXY ? process.env.NO_PROXY.split(',').map(p => p.trim()) : ['localhost', '127.0.0.1', '.local'],
  },
  audit: {
    logPath: process.env.AUDIT_LOG_PATH || './logs/audit.log',
    retentionDays: process.env.AUDIT_LOG_RETENTION_DAYS ? Number(process.env.AUDIT_LOG_RETENTION_DAYS) : 90,
  },
  clamav: {
    host: process.env.CLAMAV_HOST || 'localhost',
    port: process.env.CLAMAV_PORT ? Number(process.env.CLAMAV_PORT) : 3310,
    timeout: process.env.CLAMAV_TIMEOUT ? Number(process.env.CLAMAV_TIMEOUT) : 10000,
  },
  alerting: {
    webhookUrl: process.env.ALERT_WEBHOOK_URL,
    telegramBotToken: process.env.ALERT_TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.ALERT_TELEGRAM_CHAT_ID,
  },
};