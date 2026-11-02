FROM node:20-alpine AS base

WORKDIR /app

RUN apk add --no-cache dumb-init

COPY package*.json ./

RUN npm ci --only=production

COPY . .

RUN npm run build

FROM node:20-alpine AS production

ARG BUILD_DATE
ARG VERSION
LABEL org.opencontainers.image.created="$BUILD_DATE"
LABEL org.opencontainers.image.version="$VERSION"

WORKDIR /app

RUN addgroup -g 1001 -S nodejs
RUN adduser -S telegram -u 1001

RUN mkdir -p /app/data /app/media && chmod 700 /app/data

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/package*.json ./

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER telegram

EXPOSE 3000

ENTRYPOINT ["dumb-init", "docker-entrypoint.sh"]

CMD ["node", "dist/index.js"]