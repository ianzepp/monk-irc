# PM2 Process Management for Monk IRC

This document describes how to run monk-irc as a background service using PM2.

## Prerequisites

Before starting, ensure:
- Node.js 18+ is installed
- monk-api is running on port 8000 (production) or 9001 (development)
- monk-irc has been built: `npm run compile`

## Port Mapping

monk-irc instances connect to specific monk-api backends:

```
IRC Port 6667 → monk-api Port 8000 (production)
IRC Port 6668 → monk-api Port 9001 (development)
```

This allows you to run both production and development IRC servers simultaneously, each connecting to their respective API backends.

## Quick Start

### Single Instance (Production)

```bash
# Build production code
npm run compile

# Start monk-irc on port 6667 → connects to monk-api on port 8000
pm2 start ecosystem.config.cjs --env production

# View status
pm2 list

# View logs
pm2 logs monk-irc

# Restart
pm2 restart monk-irc

# Stop
pm2 stop monk-irc

# Delete from PM2
pm2 delete monk-irc
```

### Multiple Instances (Dev + Prod)

Run both development and production instances simultaneously:

```bash
# Start production instance (port 6667 → API 8000)
pm2 start ecosystem.config.cjs --name monk-irc-prod --env production

# Start development instance (port 6668 → API 9001)
pm2 start ecosystem.config.cjs --name monk-irc-dev --env development

# View both
pm2 list

# Logs for specific instance
pm2 logs monk-irc-prod
pm2 logs monk-irc-dev
```

## Configuration

The `ecosystem.config.cjs` file contains two environment configurations:

### Production (Default)
- **IRC Port**: 6667
- **API Backend**: http://localhost:8000
- **Host**: 0.0.0.0 (all interfaces)
- **Server Name**: irc.monk.local

### Development
- **IRC Port**: 6668
- **API Backend**: http://localhost:9001
- **Host**: 0.0.0.0 (all interfaces)
- **Server Name**: irc.monk.dev

## Connecting IRC Clients

### Production Instance (Port 6667)

```bash
# Using netcat
nc localhost 6667
NICK alice
USER root@cli-test 0 * :Alice Smith
JOIN #users

# Using irssi
irssi -c localhost -p 6667 -n alice

# Using weechat
/server add monk-prod localhost/6667
/set irc.server.monk-prod.username root@cli-test
/connect monk-prod
```

### Development Instance (Port 6668)

```bash
# Using netcat
nc localhost 6668
NICK bob
USER admin@test-tenant 0 * :Bob Developer
JOIN #users

# Using irssi
irssi -c localhost -p 6668 -n bob

# Using weechat
/server add monk-dev localhost/6668
/set irc.server.monk-dev.username admin@test-tenant
/connect monk-dev
```

## Environment Files

### .env.production

Create this file for production configuration:

```bash
IRC_PORT=6667
IRC_HOST=0.0.0.0
IRC_SERVER_NAME=irc.monk.local
MONK_API_URL=http://localhost:8000
NODE_ENV=production
```

**Security Note:** `.env.production` is gitignored and should never be committed.

### .env (Development)

For local development without PM2:

```bash
IRC_PORT=6668
IRC_HOST=localhost
IRC_SERVER_NAME=irc.monk.dev
MONK_API_URL=http://localhost:9001
NODE_ENV=development
```

## Auto-Start on Boot

To configure monk-irc to start automatically when your system boots:

### Step 1: Save PM2 Process List

```bash
pm2 save
```

This saves the current running processes to `~/.pm2/dump.pm2`.

### Step 2: Generate Startup Script (macOS)

```bash
pm2 startup
```

This will output a command like:

```bash
sudo env PATH=$PATH:/path/to/node /path/to/pm2 startup launchd -u your_username --hp /Users/your_username
```

### Step 3: Run the Generated Command

Copy and paste the command from step 2 and run it with `sudo`. You'll need to enter your password.

This creates a launchd plist at:
```
/Library/LaunchDaemons/io.keymetrics.pm2.your_username.plist
```

### Step 4: Verify

Restart your computer and check that monk-irc starts automatically:

```bash
pm2 list
```

## Monitoring

### View Real-Time Logs

```bash
# All instances
pm2 logs

# Specific instance
pm2 logs monk-irc
pm2 logs monk-irc-prod
pm2 logs monk-irc-dev
```

### View Log Files

```bash
tail -f logs/pm2-out.log
tail -f logs/pm2-error.log
```

### Check Process Status

```bash
pm2 status
pm2 info monk-irc
```

### Monitor Resources

```bash
pm2 monit
```

## Troubleshooting

### Service Won't Start

**Check monk-api is running:**

```bash
# Production API (port 8000)
curl http://localhost:8000/api/health

# Development API (port 9001)
curl http://localhost:9001/api/health
```

**Check PM2 logs:**

```bash
pm2 logs monk-irc --err --lines 50
```

**Common issues:**
- monk-api not running on expected port
- Port 6667/6668 already in use
- Missing environment variables
- Build not completed (`npm run compile`)

### Port Already in Use

Check what's using the port:

```bash
# Check port 6667
lsof -i :6667

# Check port 6668
lsof -i :6668
```

Kill the process if needed:

```bash
kill -9 <PID>
```

Or stop PM2 instance:

```bash
pm2 stop monk-irc
pm2 delete monk-irc
```

### High Memory Usage

Check memory consumption:

```bash
pm2 list
```

If consistently above 500MB, the service will auto-restart. Increase the limit in `ecosystem.config.cjs`:

```javascript
max_memory_restart: '1G',
```

### Connection Issues

**Verify IRC server is listening:**

```bash
netstat -an | grep 6667
netstat -an | grep 6668
```

**Test connection:**

```bash
nc localhost 6667
PING
# Should respond with PONG
```

**Check API connectivity from monk-irc:**

```bash
# From within monk-irc logs, look for:
pm2 logs monk-irc | grep "API"
```

## Uninstall Auto-Start

To remove the auto-start configuration:

```bash
pm2 unstartup launchd
```

Then remove the saved process list:

```bash
rm ~/.pm2/dump.pm2
```

## Advanced Configuration

### Custom Ports

Modify `ecosystem.config.cjs` to use custom ports:

```javascript
env_production: {
  IRC_PORT: 7000,  // Custom IRC port
  MONK_API_URL: 'http://localhost:8000'
}
```

### Remote API Backend

Connect to remote monk-api:

```javascript
env_production: {
  IRC_PORT: 6667,
  MONK_API_URL: 'https://api.example.com'
}
```

### Scheduled Restarts

Uncomment in `ecosystem.config.cjs`:

```javascript
cron_restart: '0 3 * * *',  // Restart daily at 3am
```

### Watch Mode (Not Recommended for Production)

To auto-restart on file changes:

```javascript
watch: true,
ignore_watch: ['node_modules', 'logs'],
```

Note: Only use for development. For production, use proper deployment process.

## Integration with monk-api PM2

Both monk-api and monk-irc can run under PM2 simultaneously:

```bash
# Start monk-api on port 8000
cd /Users/ianzepp/Workspaces/monk-api
pm2 start ecosystem.config.cjs --name monk-api

# Start monk-irc on port 6667 (connects to API 8000)
cd /Users/ianzepp/Workspaces/monk-irc
pm2 start ecosystem.config.cjs --name monk-irc --env production

# View all services
pm2 list
```

Expected output:
```
┌────┬──────────────┬─────────┬─────────┬──────┬──────────┐
│ id │ name         │ status  │ restart │ cpu  │ memory   │
├────┼──────────────┼─────────┼─────────┼──────┼──────────┤
│ 0  │ monk-api     │ online  │ 0       │ 0.1% │ 120.5mb  │
│ 1  │ monk-irc     │ online  │ 0       │ 0.0% │ 45.2mb   │
└────┴──────────────┴─────────┴─────────┴──────┴──────────┘
```

## Related Commands

```bash
# Restart all PM2 processes
pm2 restart all

# Stop all processes
pm2 stop all

# Delete all processes
pm2 delete all

# Update PM2
npm install -g pm2@latest

# PM2 web interface (optional)
pm2 web
```

## Production Checklist

- [ ] Built production code: `npm run compile`
- [ ] monk-api running on port 8000: `curl http://localhost:8000/api/health`
- [ ] Configured `.env.production` with correct MONK_API_URL
- [ ] Started service: `pm2 start ecosystem.config.cjs --env production`
- [ ] Verified connectivity: Connect IRC client to port 6667
- [ ] Saved process list: `pm2 save`
- [ ] Configured auto-start: `pm2 startup` (and run generated command)
- [ ] Tested restart: `sudo reboot` and verify with `pm2 list`
- [ ] Monitoring set up: `pm2 logs monk-irc` accessible

## Development Workflow

### Running Both Environments

```bash
# Terminal 1: Start monk-api instances
cd /Users/ianzepp/Workspaces/monk-api
pm2 start ecosystem.config.cjs --name monk-api-prod --env production    # Port 8000
pm2 start ecosystem.config.cjs --name monk-api-dev --env development    # Port 9001

# Terminal 2: Start monk-irc instances
cd /Users/ianzepp/Workspaces/monk-irc
pm2 start ecosystem.config.cjs --name monk-irc-prod --env production    # Port 6667 → API 8000
pm2 start ecosystem.config.cjs --name monk-irc-dev --env development    # Port 6668 → API 9001

# View all services
pm2 list
```

### Testing Connections

```bash
# Test production IRC (6667) → API (8000)
nc localhost 6667
NICK alice
USER root@prod-tenant 0 * :Alice
JOIN #users

# Test development IRC (6668) → API (9001)
nc localhost 6668
NICK bob
USER root@dev-tenant 0 * :Bob
JOIN #users
```

## See Also

- [PM2 Official Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [PM2 Process Management Guide](https://pm2.keymetrics.io/docs/usage/process-management/)
- [PM2 Startup Hook](https://pm2.keymetrics.io/docs/usage/startup/)
- [monk-api PM2.md](../monk-api/PM2.md) - API server PM2 configuration
