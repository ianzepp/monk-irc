# monk-irc

**Pure IRC protocol bridge for monk-api with per-user authentication**

monk-irc is a stateless IRC server that bridges IRC protocol to monk-api HTTP endpoints. It provides per-user authentication with multi-tenant and multi-server support, enabling IRC clients to interact with monk-api through natural IRC commands.

## Architecture

```
IRC Client → monk-irc (bridge) → monk-api
             (stateless)          (persistent storage)
```

**Key Design:**
- **Stateless Bridge**: No database persistence - pure in-memory protocol translation
- **Per-User Auth**: Each IRC connection authenticates independently to monk-api
- **Multi-Tenant**: Users specify tenant during IRC login (username@tenant)
- **Multi-Server**: Support multiple API backends (dev/testing/prod)

## Quick Start

### Prerequisites

- Node.js 18+
- monk-api running (http://localhost:9001 by default)

### Installation

```bash
cd /Users/ianzepp/Workspaces/monk-irc

# Install dependencies
npm install

# Configure
cp .env.example .env
# Edit .env to add API server endpoints

# Build
npm run compile

# Start
npm start
```

### Configuration

Edit `.env`:

```bash
IRC_PORT=6667
IRC_HOST=localhost
IRC_SERVER_NAME=irc.monk.local

# API Server Endpoints
API_SERVER_DEV=http://localhost:9001
API_SERVER_TESTING=http://localhost:3001
# API_SERVER_PROD=https://api.monk.example.com
API_SERVER_DEFAULT=dev

NODE_ENV=development
```

## Usage

### Connecting with IRC Client

```
Server: localhost
Port: 6667
Nickname: alice
Username: root@cli-test
              │    │
              │    └─> Tenant name
              └──────> API username
```

### IRC Protocol Flow

```
NICK alice
USER root@cli-test 0 dev :Alice Smith
     │            │ │   │
     │            │ │   └─> Display name
     │            │ └─────> API server (dev/testing/prod)
     │            └───────> Mode (ignored)
     └────────────────────> username@tenant
```

**What happens:**
1. monk-irc receives USER command
2. Parses `root@cli-test` → username="root", tenant="cli-test"
3. Calls `POST /auth/login` with credentials
4. Stores JWT for this connection
5. All subsequent operations use this user's JWT

### Example: Multiple Users, Different Tenants

```bash
# Terminal 1: User Alice on cli-test tenant
nc localhost 6667
NICK alice
USER root@cli-test 0 dev :Alice Smith
JOIN #users

# Terminal 2: User Bob on acme-corp tenant
nc localhost 6667
NICK bob
USER admin@acme-corp 0 dev :Bob Jones
JOIN #users
```

Each user operates in their own tenant with their own permissions.

## How It Works

### Pure In-Memory Bridge

monk-irc maintains **zero persistent state**. All data is in-memory and ephemeral:

- **Connections**: Active TCP sockets
- **Channels**: In-memory sets of connections
- **Messages**: Routed in real-time, not stored
- **Authentication**: JWT per connection (from monk-api)

### Channel Mapping

Channels are meeting points for IRC users:

```
#users    → Context for discussing/managing users schema
#tasks    → Context for discussing/managing tasks schema
#projects → Context for discussing/managing projects schema
```

Channels don't persist data - they're just routing contexts for messages.

### Authentication Per Connection

```typescript
interface IrcConnection {
  socket: Socket;
  nickname: string;        // IRC display name
  username: string;        // API username (from username@tenant)
  tenant: string;          // API tenant
  serverName: string;      // API server identifier
  apiUrl: string;          // Resolved API URL
  jwt: string;             // JWT from POST /auth/login
  channels: Set<string>;   // In-memory channel membership
}
```

Each connection has its own JWT, enabling:
- Per-user permissions
- Multi-tenant isolation
- Audit trails in monk-api

## Multi-Server Support

Configure multiple API backends:

```bash
API_SERVER_DEV=http://localhost:9001
API_SERVER_TESTING=http://localhost:3001
API_SERVER_PROD=https://api.production.com
```

Users select server during login:

```
USER root@cli-test 0 dev :Alice      # → localhost:9001
USER root@cli-test 0 testing :Alice  # → localhost:3001
USER root@cli-test 0 prod :Alice     # → production.com
```

## IRC Commands Supported

### Registration
- `NICK <nickname>` - Set IRC display name
- `USER <username@tenant> <mode> <servername> :<realname>` - Authenticate to monk-api

### Connection
- `PING` - Keepalive
- `QUIT [:message]` - Disconnect

### Channels
- `JOIN #channel` - Join channel (in-memory)
- `PART #channel [:message]` - Leave channel
- `NAMES #channel` - List channel members
- `LIST` - List active channels

### Messaging
- `PRIVMSG #channel :message` - Send to channel
- `PRIVMSG nick :message` - Send to user (ephemeral)

### Information
- `TOPIC #channel` - Get channel topic (always empty - no persistence)
- `WHO #channel` - Query channel members
- `WHOIS nick` - Query user info
- `MODE` - Minimal mode support

## Integration with monk-bot

monk-bot can connect as a regular IRC user and provide AI assistance:

```bash
# monk-bot connects
NICK monk-bot
USER monk-bot-admin@monk-bot-state 0 dev :AI Assistant
JOIN #users

# User asks question
alice: show me all active users

# monk-bot responds (using its JWT to query monk-api)
monk-bot: Found 12 active users: alice, bob, carol, ...
```

See [monk-bot](../monk-bot) for AI agent implementation.

## Project Structure

```
monk-irc/
├── src/
│   ├── index.ts              # Entry point, server setup
│   ├── lib/
│   │   ├── irc-server.ts     # Core server, connection handling
│   │   ├── base-command.ts   # Base class for commands
│   │   └── types.ts          # TypeScript interfaces
│   └── commands/             # IRC command handlers
│       ├── nick.ts           # NICK command
│       ├── user.ts           # USER command (authentication)
│       ├── join.ts           # JOIN command
│       ├── part.ts           # PART command
│       ├── privmsg.ts        # PRIVMSG command
│       ├── names.ts          # NAMES command
│       └── ... (others)
├── PROXY_PLAN.md             # Detailed architecture plan
└── README.md                 # This file
```

## Development

```bash
# Run in development mode with auto-reload
npm run dev

# Compile TypeScript
npm run compile

# Start production server
npm start
```

## Troubleshooting

### Connection refused
- Ensure monk-api is running: `curl http://localhost:9001/api/health`

### Authentication failed
- Check tenant exists in monk-api
- Verify username has access to tenant
- Check API server is reachable

### Can't join channels
- Ensure you've completed registration (NICK + USER)
- Check authentication succeeded (look for welcome messages)

## Comparison to monk-ftp

Both monk-ftp and monk-irc are **pure protocol bridges**:

| Feature | monk-ftp | monk-irc |
|---------|----------|----------|
| Protocol | FTP → HTTP | IRC → HTTP |
| State | Stateless | Stateless |
| Auth | Per-connection | Per-connection |
| Persistence | None (pure bridge) | None (pure bridge) |
| Use Case | File operations | Chat/collaboration |

## Architecture Notes

### Why No Persistence?

monk-irc is a **pure bridge** - it translates IRC protocol to monk-api calls but stores nothing itself:

- **Simpler**: No database, no schemas, no migrations
- **Scalable**: Stateless servers can be load-balanced
- **Secure**: No credential storage, JWT expires naturally
- **Maintainable**: Protocol translation only

Persistence happens in monk-api where it belongs.

### Why IRC?

IRC is a simple, well-defined, text-based protocol that:
- Works with any IRC client (irssi, weechat, hexchat, etc.)
- Enables multi-user collaboration
- Provides a natural interface for AI agents (monk-bot)
- Requires no custom client development

## Documentation

- [PROXY_PLAN.md](./PROXY_PLAN.md) - Detailed architecture and implementation plan
- [monk-api](../monk-api) - Backend API documentation
- [monk-bot](../monk-bot) - AI agent integration

## License

MIT

## Author

Ian Zepp <ian.zepp@protonmail.com>

---

**Status**: Phase 1 Complete - Pure authentication bridge working
**Next**: Phase 2 - Channel→schema bridging for data operations
