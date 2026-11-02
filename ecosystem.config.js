module.exports = {
  apps: [{
    name: 'telegram-monitor',
    script: 'dist/index.js',
    instances: 'max',
    max_memory_restart: '500M',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    error: './logs/err.log',
    out: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    cron_restart: '0 0 * * *',
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'data'],
    env_production: {
      PORT: 3000,
      DATABASE_URL: 'postgresql://postgres:password@postgres:5432/telegram_monitor',
      REDIS_URL: 'redis://redis:6379',
    },
  }],
};