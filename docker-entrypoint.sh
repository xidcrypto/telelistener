#!/bin/bash

set -e

mkdir -p /app/data
chown -R telegram:nodejs /app/data

cat > /app/.env << EOF
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
TRUST_PROXY=true
DATABASE_URL=postgresql://postgres:password@postgres:5432/telegram_monitor
REDIS_URL=redis://redis:6379
API_ID=
API_HASH=
PHONE_NUMBER=
SESSION_ENC_KEY=
CHANNEL_USERNAME=airdropfind
EOF

echo "Docker container started"