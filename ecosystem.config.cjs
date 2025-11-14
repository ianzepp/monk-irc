/**
 * PM2 Ecosystem Configuration for Monk IRC
 *
 * IMPORTANT: Before starting, create .env.production with required variables:
 *   IRC_PORT=6667
 *   IRC_HOST=0.0.0.0
 *   IRC_SERVER_NAME=irc.monk.local
 *   MONK_API_URL=http://localhost:8000
 *   NODE_ENV=production
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 logs monk-irc
 *   pm2 restart monk-irc
 *   pm2 stop monk-irc
 *   pm2 delete monk-irc
 *
 * Multiple instances (different environments):
 *   pm2 start ecosystem.config.cjs --name monk-irc-prod --env production
 *   pm2 start ecosystem.config.cjs --name monk-irc-dev --env development
 *
 * Auto-start on boot:
 *   pm2 startup
 *   pm2 save
 */

module.exports = {
  apps: [
    {
      name: 'monk-irc',
      script: 'dist/index.js',
      cwd: '/Users/ianzepp/Workspaces/monk-irc',

      // Process management
      instances: 1,
      exec_mode: 'fork',

      // Auto-restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',

      // Crash handling
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,

      // Production environment - loaded from .env.production
      // Port 6667 connects to monk-api on port 8000 (production)
      env_production: {
        NODE_ENV: 'production',
        IRC_PORT: 6667,
        IRC_HOST: '0.0.0.0',
        IRC_SERVER_NAME: 'irc.monk.local',
        MONK_API_URL: 'http://localhost:8000'
      },

      // Development environment
      // Port 6668 connects to monk-api on port 9001 (development)
      env_development: {
        NODE_ENV: 'development',
        IRC_PORT: 6668,
        IRC_HOST: '0.0.0.0',
        IRC_SERVER_NAME: 'irc.monk.dev',
        MONK_API_URL: 'http://localhost:9001'
      },

      // Logging
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Process identifier
      pid_file: 'logs/monk-irc.pid',

      // Cron restart (optional - restart daily at 3am)
      // cron_restart: '0 3 * * *',

      // Advanced options
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: true,
    }
  ]
};
