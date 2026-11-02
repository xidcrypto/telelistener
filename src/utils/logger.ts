import { configure, getLogger, type Logger } from 'pino';
import { config } from './config/index.js';
import { redactPaths } from './redactions.js';

export const logger = configure({
  level: config.logging.level,
  formatters: {
    level: (label) => ({ level: label }),
    log: (object) => {
      const requestId = object.id || object.reqId || object.requestId;
      if (requestId) {
        object.request_id = requestId;
        delete object.id;
        delete object.reqId;
        delete object.requestId;
      }
      return object;
    },
  },
  prettyPrint:
    config.logging.format === 'pretty'
      ? {
          colorize: true,
          translateTime: 'sys:standard',
          ignore: 'pid,hostname,req_id',
        }
      : false,
  serializers: {
    req: pinoHttpSerializer,
    res: pinoHttpSerializer,
  },
  hooks: {
    logMethod: (inputArgs, method) => {
      const args = inputArgs.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          return redactPaths(arg, config.logging.redactionPatterns);
        }
        return arg;
      });
      method.apply(logger, args);
    },
  },
}).child({
  service: 'telegram-monitor',
  version: process.env.npm_package_version,
});

function pinoHttpSerializer(input: any): any {
  if (!input) return null;

  const serialized = {
    method: input.method,
    url: input.url,
    query: input.query,
    headers: redactPaths(input.headers, ['authorization', 'cookie', 'authorization', 'x-api-key']),
    remoteAddress: input.socket?.remoteAddress || input.ip || input.connection?.remoteAddress,
    userAgent: input.headers?.['user-agent'],
  };

  return serialized;
}

export function generateRequestId(req, res, next): void {
  const existingId = req.headers['x-request-id'] || req.headers['x-trace-id'];
  req.id = existingId as string || generateId();
  res.setHeader('X-Request-ID', req.id);
  next();
}

function generateId(): string {
  return `req_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
}

export { Logger };