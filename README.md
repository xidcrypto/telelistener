# Telegram Monitor

Production-grade Telegram channel monitoring system with real-time WebSocket support and webhook delivery.

## Overview

Telegram Monitor is a robust backend system designed to capture and process messages from Telegram channels in real-time. It supports:

- Real-time message capture via MTProto (no polling)
- WebSocket and SSE for real-time client updates
- Outbound webhook delivery with anti-SSRF protection
- RESTful API for message querying and management
- Comprehensive security with authentication and authorization
- Complete observability with metrics and logging

## Key Features

- **No Polling**: Uses MTProto push notifications for real-time updates
- **Real-time Delivery**: WebSocket and SSE protocols for client updates
- **Secure Webhooks**: HMAC signatures, replay protection, and anti-SSRF
- **Full REST API**: CRUD operations for channels, messages, and webhooks
- **Enterprise Security**: API key auth, RBAC, rate limiting, and input validation
- **High Availability**: Redis-backed leader election and distributed pub/sub
- **Observability**: Prometheus metrics, structured logging, and health checks
- **Scalable Architecture**: Modular design with configurable channels

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     WebSocket Gateway                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   Client    │◄──►│  WS Manager │◄──►│ Redis Pub/Sub │       │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     Telegram Listener                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   MTProto   │◄──►│   Session   │◄──►│   Database   │       │
│  │   Client    │    │  Manager    │    │   Service    │       │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     Message Queue                            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  Webhook    │◄──►│   Webhook   │◄──►│   Webhook   │       │
│  │   Queue     │    │    Store     │    │  Delivery   │       │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     Media Processing                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   Media     │◄──►│   File      │◄──►│   Storage   │       │
│  │   Processor │    │   System    │    │  (S3/Local)│       │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     REST API Server                           │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ Express.js  │◄──►│   Middleware│◄──►│   Routes    │       │
│  │  (4.x)     │    │  (Auth, Rate│    │   (API v1) │       │
│  └─────────────┘    │   Limit)     │    └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Deployment/Orchestration                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  Docker    │◄──►│   PM2       │◄──►│  Systemd    │       │
│  │   Compose  │    │  (Process   │    │  (Production)│     │
│  │           │    │    Manager)  │    │             │       │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## Getting Started

### Prerequisites

- Node.js 20 LTS
- PostgreSQL 16+
- Redis 6+

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd telegram-monitor
   ```

2. Install dependencies:
   ```bash
   npm ci
   ```

3. Copy the environment file and configure:
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

4. Run database migrations:
   ```bash
   npx pg-migrate up
   ```

5. Configure Telegram API credentials:
   - Get API_ID and API_HASH from [my.telegram.org](https://my.telegram.org)
   - Generate a 32-byte SESSION_ENC_KEY:
     ```bash
     openssl rand -hex 32 | xxd -r -p | base64
     ```

6. Run the login script to authenticate:
   ```bash
   npm run login
   ```

7. Start the application:
   ```bash
   npm start
   ```

### Development Mode

For development with SQLite and hot reload:

1. Install dependencies:
   ```bash
   npm ci
   ```

2. Copy environment file and update:
   ```bash
   cp .env.example .env
   # Update DATABASE_URL to use SQLite
   export DATABASE_URL=sqlite:///./dev.db
   ```

3. Run with hot reload:
   ```bash
   npm run dev
   ```

### Docker Deployment

1. Build and run with docker-compose:
   ```bash
   docker compose up -d
   ```

2. Run the login script inside the container:
   ```bash
   docker compose exec app npm run login
   ```

3. For production, set up reverse proxy with Caddy or Nginx

## API Documentation

The API documentation is automatically generated from Zod schemas and available at `/docs` in non-production environments.

### Health Checks

- `GET /health` - Basic health check
- `GET /api/v1/health` - Detailed health check
- `GET /api/v1/ready` - Readiness probe (checks DB, Redis, Telegram)
- `GET /api/v1/status` - Protected status endpoint

### Authentication

All endpoints require API key authentication via the `X-API-Key` header:

```bash
GET /api/v1/channels
Host: api.example.com
X-API-Key: tm_xxxxxx
```

### Channels API

**Get all channels:**
```bash
GET /api/v1/channels
Authorization: Bearer <token>
```

**Create a new channel:**
```bash
POST /api/v1/channels
Authorization: Bearer <token>
Content-Type: application/json

{
  "telegramChannelId": "-1001234567890",
  "username": "airdropfind",
  "title": "Airdrop Find",
  "isVerified": true,
  "memberCount": 1000,
  "description": "Find airdrops and updates"
}
```

**Get channel messages:**
```bash
GET /api/v1/channels/{id}/messages?limit=50&fromDate=2024-01-01T00:00:00Z
Authorization: Bearer <token>
```

**Get message details:**
```bash
GET /api/v1/messages/{id}
Authorization: Bearer <token>
```

**Get message revisions:**
```bash
GET /api/v1/messages/{id}/revisions
Authorization: Bearer <token>
```

**Get media file:**
```bash
GET /api/v1/media/{id}
Authorization: Bearer <token>
```

### WebSocket API

Generate a WebSocket ticket:
```bash
POST /api/v1/ws-ticket
Authorization: Bearer <token>
Content-Type: application/json

{
  "ttl": 30,
  "channels": "airdropfind"
}
```

Connect to WebSocket with the ticket:
```javascript
const ws = new WebSocket('ws://localhost:3000/api/v1/ws?token=ws_token_...');

ws.onopen = () => {
  ws.send(JSON.stringify({
    action: 'subscribe',
    channels: ['airdropfind'],
    filter: {
      keyword: [],
      hashtag: [],
      hasLink: true
    }
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Message received:', data);
};
```

### Webhook API

**Create a webhook:**
```bash
POST /api/v1/webhooks
Authorization: Bearer <token>
Content-Type: application/json

{
  "channelId": "1",
  "url": "https://your-webhook-endpoint.com",
  "secret": "generated-secret",
  "events": ["new", "edit", "delete"],
  "isActive": true
}
```

**Test a webhook:**
```bash
POST /api/v1/webhooks/{id}/test
Authorization: Bearer <token>
```

### SSE API

For Server-Sent Events:
```bash
GET /api/v1/stream
Authorization: Bearer <token>
Accept: text/event-stream
```

## Security

### API Key Management

API keys are generated as 256-bit random strings with a configurable prefix (default: `tm_`):

```javascript
// Generate a new API key
const apiKey = generateApiKey();
console.log(apiKey); // tm_xxxxxx...
```

API keys have the following properties:
- 256-bit random value
- Argon2id hashing with configurable iterations
- Optional expiration time
- Scope-based permissions (read, admin, webhook)

### Webhook Security

Webhooks are secured with HMAC-SHA256 signatures:

1. **Signature Generation**:
   ```javascript
   const signature = crypto.createHmac('sha256', webhookSecret)
     .update(`${timestamp}.${payload}`)
     .digest('hex');
   ```

2. **Signature Verification**:
   ```javascript
   const expectedSignature = crypto.createHmac('sha256', webhookSecret)
     .update(`${timestamp}.${payload}`)
     .digest('hex');
   
   if (signature !== expectedSignature) {
     throw new Error('Invalid signature');
   }
   ```

3. **Required Headers**:
   - `X-Signature`: HMAC-SHA256 signature
   - `X-Timestamp`: Unix timestamp of payload creation
   - `X-Event-Id`: Unique event identifier for idempotency

### Anti-SSRF Protection

Outbound webhooks are protected against SSRF with:
- Only HTTPS URLs allowed
- Private IP range blocking (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, ::1, fc00::/7)
- DNS rebinding protection
- Metadata service blocking (169.254.169.254, *.metadata.google.internal)
- Strict redirect blocking

### Rate Limiting

Multi-layered rate limiting:
- Global rate limit: 1000 requests/minute
- Per-IP rate limit: 100 requests/minute
- Per-key rate limit: 100 requests/minute
- Endpoint-specific limits for expensive operations

### Input Validation

All input is validated using Zod schemas:
- Request body validation
- Query parameter validation
- Path parameter validation
- Header validation
- Rejects unknown fields

## Configuration

### Environment Variables

See `.env.example` for all configuration options.

### Key Configuration Points

- **TELEGRAM_CHANNEL_USERNAME**: The channel username to monitor (e.g., `airdropfind`)
- **SESSION_ENC_KEY**: 32-byte base64-encoded key for session encryption
- **DATABASE_URL**: PostgreSQL connection string
- **REDIS_URL**: Redis connection string
- **API_KEY_PREFIX**: Prefix for API keys
- **ALLOWED_ORIGINS**: Comma-separated list of allowed origins for CORS

### Production Settings

```bash
NODE_ENV=production
TRUST_PROXY=true
PORT=3000
CORS_ALLOWED_ORIGINS=https://app.example.com,https://api.example.com
SSL_CERT_PATH=/path/to/cert.pem
SSL_KEY_PATH=/path/to/key.pem
```

## Monitoring

### Metrics

Prometheus metrics are available at `/metrics` (requires authentication):

- `http_requests_total`: Total HTTP requests by method, route, and status code
- `http_request_duration_seconds`: HTTP request duration histogram
- `telegram_messages_received_total`: Messages received from Telegram
- `websocket_connections`: Active WebSocket connections
- `webhook_deliveries_total`: Webhook delivery attempts
- `queue_size`: Size of internal queues

### Logging

Structured JSON logging with request correlation:

```json
{
  "id": "req_xxxxxx",
  "method": "GET",
  "url": "/api/v1/channels",
  "statusCode": 200,
  "responseTime": 45,
  "userAgent": "curl/7.68.0",
  "remoteAddress": "192.168.1.100"
}
```

Sensitive data is redacted:
- Authorization headers
- API keys
- Session data
- Phone numbers
- OTP values

## Testing

### Unit Tests

Run unit tests:
```bash
npm run test
```

### Integration Tests

Run integration tests:
```bash
npm run test:coverage
```

### Test Coverage

The test suite includes:
- API key authentication and authorization
- Input validation
- Rate limiting
- Duplicate message detection
- URL and hashtag parsing
- Webhook signature verification
- SSRF protection
- WebSocket authentication and communication
- Shutdown behavior
- Mock Telegram client events

## Deployment

### Docker Deployment

Complete Docker deployment with Caddy reverse proxy:

1. Build and run:
   ```bash
   docker compose up -d
   ```

2. Configure Telegram session:
   ```bash
   docker compose exec app npm run login
   ```

3. Configure environment variables for production

### Systemd Service

For production with systemd:

```ini
[Unit]
Description=Telegram Monitor
After=network.target

[Service]
Type=simple
User=telegram
WorkingDirectory=/app
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=-/app/.env

[Install]
WantedBy=multi-user.target
```

### PM2 Process Manager

For production with PM2:

```bash
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## Development

### Development Commands

```bash
# Start with hot reload
npm run dev

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Run type checking
npm run typecheck

# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Build for production
npm run build
```

### Code Quality

- TypeScript with strict mode
- ESLint with Prettier
- Comprehensive unit and integration tests
- Type checking for all components
- Linting for consistent code style

## Troubleshooting

### Common Issues

#### Session Not Loading

Check that:
1. The session file exists at `~/.local/share/telegram-monitor/session.enc`
2. The SESSION_ENC_KEY is correct
3. The API credentials are correct

#### Database Connection Issues

Ensure PostgreSQL is running and the DATABASE_URL is correctly configured.

#### WebSocket Connection Issues

Check CORS configuration and ensure the origin is allowed.

#### Webhook Delivery Issues

Check webhook URL accessibility and retry logic in the logs.

### Logging

All logs are written to stdout in JSON format. Use your logging system to capture and analyze them.

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Run tests and linting
5. Submit a pull request

## Support

For support, please create an issue in the repository.

## Acknowledgments

- [Telegram.ts](https://github.com/Telegram-ts/router) - MTProto client
- [pino](https://github.com/pinojs/pino) - Structured logging
- [Zod](https://github.com/colinhacks/zod) - Schema validation
- [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) - Rate limiting
- [BullMQ](https://github.com/bullmq-io/bullmq) - Queue system
- [prom-client](https://github.com/prometheus/client_node) - Metrics
- [Caddy](https://github.com/caddyserver/caddy) - Reverse proxy

## Future Enhancements

- gRPC API for high-performance clients
- GraphQL gateway for complex queries
- Multi-region deployment support
- Custom event filters
- Message prioritization
- Analytics and insights

---

*Built with ❤️ for the Telegram community*
