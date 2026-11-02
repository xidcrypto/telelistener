import client from 'prom-client';

const register = new client.Registry();

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

const telegramMessagesReceived = new client.Counter({
  name: 'telegram_messages_received_total',
  help: 'Total number of messages received from Telegram',
  labelNames: ['type'],
});

const websocketConnections = new client.Gauge({
  name: 'websocket_connections',
  help: 'Number of active WebSocket connections',
});

const webhookDeliveries = new client.Counter({
  name: 'webhook_deliveries_total',
  help: 'Total number of webhook delivery attempts',
  labelNames: ['status'],
});

const queueSize = new client.Gauge({
  name: 'queue_size',
  help: 'Size of internal queues',
  labelNames: ['queue'],
});

register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDurationSeconds);
register.registerMetric(telegramMessagesReceived);
register.registerMetric(websocketConnections);
register.registerMetric(webhookDeliveries);
register.registerMetric(queueSize);

export async function prometheusMetrics(): Promise<string> {
  return register.metrics();
}

export function incrementHttpRequests(method: string, route: string, statusCode: number): void {
  httpRequestsTotal.labels(method, route, statusCode.toString()).inc();
}

export function observeHttpDuration(method: string, route: string, duration: number): void {
  httpRequestDurationSeconds.labels(method, route).observe(duration);
}

export function incrementTelegramMessages(type: string): void {
  telegramMessagesReceived.labels(type).inc();
}

export function setWebsocketConnections(count: number): void {
  websocketConnections.set(count);
}

export function incrementWebhookDeliveries(status: string): void {
  webhookDeliveries.labels(status).inc();
}

export function setQueueSize(queue: string, size: number): void {
  queueSize.labels(queue).set(size);
}
