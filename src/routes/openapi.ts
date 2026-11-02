import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { logger } from '../utils/logger.js';

export class OpenAPIHandler {
  public readonly router = express.Router();

  constructor() {
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.router.use('/', swaggerUi.serve);
    this.router.get('/', swaggerUi.setup({
      openapi: '3.1.0',
      info: {
        title: 'Telegram Monitor API',
        description: 'Production-grade Telegram channel monitoring system',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'https://api.example.com',
          description: 'Production server',
        },
        {
          url: 'http://localhost:3000',
          description: 'Development server',
        },
      ],
      paths: {
        '/api/v1/health': {
          get: {
            summary: 'Health check',
            description: 'Returns the health status of the application',
            operationId: 'getHealth',
            tags: ['System'],
            responses: {
              '200': {
                description: 'Health check successful',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', example: 'ok' },
                        timestamp: { type: 'string', format: 'date-time' },
                        uptime: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }, {
      swaggerUrl: '/docs/swagger.json',
    }));
  }
}