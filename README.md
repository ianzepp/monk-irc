# monk-irc

**Pure IRC protocol bridge for monk-api with per-user authentication**

monk-irc is a stateless IRC server that bridges IRC protocol to monk-api HTTP endpoints. It provides per-user authentication with multi-tenant and multi-server support, enabling IRC clients to interact with monk-api schemas through natural IRC commands.

## Architecture

```
IRC Client → monk-irc (bridge) → monk-api
             (stateless)          (persistent storage)
```

**Key Design Principles:**
- **Stateless Bridge**: No database persistence - pure in-memory protocol translation
- **Per-User Auth**: Each IRC connection authenticates independently to monk-api
- **Multi-Tenant**: Users specify tenant during IRC login (username@tenant format)
- **Multi-Server**: Support multiple API backends (dev/testing/prod)
- **Schema Channels**: IRC channels map to monk-api schemas for data operations
- **Record Channels**: Focused channels for specific records (#schema/recordId)

## Quick Start

### Prerequisites

- Node.js 18+
- monk-api running (http://localhost:9001 by default)

### Installation

```bash
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

## Authentication

### IRC Client Setup

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
3. Calls `POST /auth/login` to monk-api with tenant and username
4. Stores JWT for this connection
5. All subsequent operations use this user's JWT for API calls

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

Each user operates in their own tenant with their own permissions. Alice sees cli-test data, Bob sees acme-corp data.

## Channel Types

monk-irc supports two types of channels:

### Schema-Level Channels

General discussion about a schema:

```
JOIN #users
→ Topic: "Schema context: users (12 records available)"
→ Shows count of records in schema
→ Broadcasts to all users in channel
```

**Use cases:**
- General discussion about schema design
- Announcing bulk operations
- Collaborative schema management

### Record-Specific Channels

Focused discussion about a specific record:

```
JOIN #users/18b4f885-7c54-4f0f-a08c-eaafa5b8c25e
→ Topic: "Record context: users/18b4f885-7c54-4f0f-a08c-eaafa5b8c25e (record: Root User)"
→ Shows record identifier (name/title/username field)
→ Perfect for monk-bot to maintain context
```

**Use cases:**
- Focused conversation about one record
- monk-bot understands which record you're discussing
- Avoid confusion when multiple users work on different records
- Thread-like experience similar to Slack/Discord

**Shortened UUIDs supported:**
```
JOIN #users/18b4f885          # First 8 characters
JOIN #users/18b4f885-7c54     # Partial UUID
```

## IRC Commands Supported

monk-irc implements **20 IRC commands** for full client compatibility:

### Registration & Connection
- `NICK <nickname>` - Set IRC display name
- `USER <username@tenant> <mode> <servername> :<realname>` - Authenticate to monk-api
- `PING` - Keepalive (responds with PONG)
- `QUIT [:message]` - Disconnect gracefully

### Channel Operations
- `JOIN #channel` - Join schema or record channel
- `PART #channel [:message]` - Leave channel
- `LIST` - List active channels
- `NAMES #channel` - List channel members
- `TOPIC #channel` - Get channel topic (schema/record info)

### Messaging
- `PRIVMSG #channel :message` - Send message to channel
- `PRIVMSG nick :message` - Send private message to user
- `NOTICE #channel :message` - Send notice (doesn't trigger auto-replies, critical for bots)

### Channel Management
- `KICK #channel <nick> [:reason]` - Remove user from channel (checks API permissions)
- `INVITE <nick> #channel` - Invite user to channel

### User Information
- `WHOIS <nick>` - Query user details (shows away status, channels, idle time)
- `WHO #channel` - Query channel members
- `ISON <nick> [<nick> ...]` - Check if users are online

### User Status
- `AWAY [:message]` - Set/unset away status (shown in WHOIS)
- `MODE <target> [<modestring>]` - User/channel modes (minimal support)

### Server Information
- `MOTD` - Show Message of the Day (server info, API connection details)
- `VERSION` - Show server version

## How It Works

### Pure In-Memory Bridge

monk-irc maintains **zero persistent state**:

- **Connections**: Active TCP sockets with per-user JWT
- **Channels**: In-memory sets of connections for routing
- **Messages**: Routed in real-time, not stored
- **Authentication**: JWT per connection (from monk-api)

All data operations happen in monk-api. monk-irc only translates IRC protocol to HTTP.

### Channel → Schema Mapping

When you join a channel, monk-irc queries monk-api with your JWT:

```
JOIN #users
→ GET /api/data/users (with user's JWT)
→ Returns: {data: [...]}
→ Topic shows: "Schema context: users (12 records available)"
```

```
JOIN #users/18b4f885-7c54-4f0f-a08c-eaafa5b8c25e
→ GET /api/data/users/18b4f885-7c54-4f0f-a08c-eaafa5b8c25e (with user's JWT)
→ Returns: {data: {id: "...", name: "Root User", ...}}
→ Topic shows: "Record context: users/UUID (record: Root User)"
```

**Permission Enforcement:**
- 403 response → "Access denied to schema 'users'"
- 404 response → "Record not found" or "Schema not found"
- Each user sees only what their JWT allows

### Per-User Authentication

```typescript
interface IrcConnection {
  socket: Socket;
  nickname: string;        // IRC display name
  username: string;        // API username (from username@tenant)
  tenant: string;          // API tenant
  serverName: string;      // API server identifier (dev/testing/prod)
  apiUrl: string;          // Resolved API URL
  jwt: string;             // JWT from POST /auth/login
  channels: Set<string>;   // In-memory channel membership
  awayMessage?: string;    // Away status message
}
```

Each connection has its own JWT, enabling:
- Per-user permissions enforced by monk-api
- Multi-tenant isolation (Alice can't see Bob's tenant data)
- Audit trails in monk-api (operations logged by user)

## Multi-Server Support

Configure multiple API backends:

```bash
API_SERVER_DEV=http://localhost:9001
API_SERVER_TESTING=http://localhost:3001
API_SERVER_PROD=https://api.production.com
API_SERVER_DEFAULT=dev
```

Users select server during login:

```
USER root@cli-test 0 dev :Alice      # → localhost:9001
USER root@cli-test 0 testing :Alice  # → localhost:3001
USER root@cli-test 0 prod :Alice     # → production.com
```

Different users can connect to different API servers simultaneously.

## Integration with monk-bot

monk-bot connects as a regular IRC user and provides AI-assisted data operations:

```irc
# monk-bot connects
NICK monk-bot
USER monk-bot-admin@monk-bot-state 0 dev :AI Assistant
JOIN #users

# User asks question in schema channel
alice: show me all active users

# monk-bot queries monk-api using its JWT
monk-bot: Found 12 active users: alice, bob, carol, ...

# User switches to record-specific channel
alice: JOIN #users/18b4f885
alice: update this user's email to new@example.com

# monk-bot knows context from channel name
monk-bot: Updated email for Root User to new@example.com
```

**Why NOTICE is critical for monk-bot:**
- monk-bot uses `NOTICE` instead of `PRIVMSG` to send responses
- IRC clients don't trigger auto-replies on NOTICE messages
- Prevents infinite loops between bots

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
│   └── commands/             # IRC command handlers (20 commands)
│       ├── nick.ts           # NICK - Set nickname
│       ├── user.ts           # USER - Authenticate to monk-api
│       ├── join.ts           # JOIN - Join schema/record channels
│       ├── part.ts           # PART - Leave channel
│       ├── privmsg.ts        # PRIVMSG - Send messages
│       ├── notice.ts         # NOTICE - Bot messages
│       ├── kick.ts           # KICK - Remove user (checks API permissions)
│       ├── invite.ts         # INVITE - Invite to channel
│       ├── names.ts          # NAMES - List channel members
│       ├── list.ts           # LIST - List active channels
│       ├── topic.ts          # TOPIC - Show channel topic
│       ├── who.ts            # WHO - Query channel members
│       ├── whois.ts          # WHOIS - Query user info
│       ├── away.ts           # AWAY - Set away status
│       ├── ison.ts           # ISON - Check who's online
│       ├── mode.ts           # MODE - User/channel modes
│       ├── ping.ts           # PING - Keepalive
│       ├── quit.ts           # QUIT - Disconnect
│       ├── motd.ts           # MOTD - Message of the day
│       └── version.ts        # VERSION - Server version
├── .env.example              # Configuration template
├── package.json
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

# Run tests
npm test
```

## Troubleshooting

### Connection refused
```bash
# Ensure monk-api is running
curl http://localhost:9001/api/health
```

### Authentication failed
- Check tenant exists in monk-api
- Verify username has access to tenant
- Check API server is reachable
- Look for "Authentication failed" in server logs

### Can't join channels
- Ensure you've completed registration (NICK + USER)
- Check authentication succeeded (look for welcome messages: 001-004)
- Verify you have permissions to the schema (403 = access denied)

### Record not found
- Verify record ID is correct (full UUID or first 8+ characters)
- Check you have read access to the schema
- Record may have been deleted

## Comparison to monk-ftp

Both monk-ftp and monk-irc are **pure protocol bridges**:

| Feature | monk-ftp | monk-irc |
|---------|----------|----------|
| Protocol | FTP → HTTP | IRC → HTTP |
| State | Stateless | Stateless |
| Auth | Per-connection JWT | Per-connection JWT |
| Persistence | None (pure bridge) | None (pure bridge) |
| Use Case | File/CRUD operations | Chat/collaboration/AI |
| Channels | Directories = schemas | Channels = schemas/records |
| Multi-user | Sequential | Concurrent chat |

## Architecture Benefits

### Why No Persistence?

monk-irc is a **pure bridge** - it translates IRC protocol to monk-api calls but stores nothing itself:

- **Simpler**: No database, no schemas, no migrations
- **Scalable**: Stateless servers can be load-balanced
- **Secure**: No credential storage, JWT expires naturally
- **Maintainable**: Protocol translation only
- **Single Source of Truth**: All data lives in monk-api

### Why IRC?

IRC is a simple, well-defined, text-based protocol that:
- Works with any IRC client (irssi, weechat, hexchat, mIRC, etc.)
- Enables multi-user real-time collaboration
- Provides a natural interface for AI agents (monk-bot)
- Requires no custom client development
- Battle-tested protocol (35+ years)
- Low overhead, high performance

## Advanced Usage

### Using with irssi

```bash
# Install irssi
brew install irssi  # macOS
apt-get install irssi  # Ubuntu

# Connect
irssi -c localhost -p 6667 -n alice

# In irssi
/connect localhost 6667 alice root@cli-test:dev

# Join channels
/join #users
/join #users/18b4f885
```

### Using with weechat

```bash
# Add server
/server add monk localhost/6667 -autoconnect

# Set user info
/set irc.server.monk.nicks alice
/set irc.server.monk.username root@cli-test
/set irc.server.monk.realname "Alice Smith"

# Connect
/connect monk

# Join channels
/join #users
```

### Multiple Channels Workflow

```irc
# Join general schema channel
JOIN #users

# List all users (monk-bot listens here)
alice: monk-bot, show all users
monk-bot: Found 12 users...

# Switch to specific user for focused work
JOIN #users/18b4f885

# Update specific user (monk-bot knows context from channel)
alice: monk-bot, update email to new@example.com
monk-bot: Updated email for Root User

# Back to general channel
PART #users/18b4f885
```

## Security Considerations

- **JWT Storage**: JWTs are stored in-memory per connection, never persisted to disk
- **No Credentials**: monk-irc never handles passwords (monk-api authentication only)
- **Permission Enforcement**: All API operations use user's JWT, enforced by monk-api
- **Tenant Isolation**: Users can only access their own tenant data
- **SSL/TLS**: Configure nginx/caddy reverse proxy for encryption (IRC doesn't have native SSL)

## Performance

- **Memory**: ~50-100 KB per connection
- **CPU**: Minimal (protocol parsing only)
- **Scalability**: Stateless design allows horizontal scaling
- **Latency**: <1ms for message routing, API latency for schema queries

## Roadmap

- [ ] Enhanced LIST command to query `/api/describe/list` for available schemas
- [ ] Custom command: `/SCHEMA <name>` to show schema structure
- [ ] SSL/TLS support (direct or reverse proxy documentation)
- [ ] Rate limiting per connection
- [ ] Metrics and monitoring endpoints
- [ ] Docker containerization

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT

## Author

Ian Zepp <ian.zepp@protonmail.com>

---

**Status**: Production Ready - Full IRC bridge with 20 commands, multi-tenant auth, and record-specific channels

**monk ecosystem:**
- [monk-api](../monk-api) - Backend REST API with schema engine
- [monk-irc](../monk-irc) - IRC protocol bridge (this project)
- [monk-bot](../monk-bot) - AI agent for natural language data operations
- [monk-ftp](../monk-ftp) - FTP protocol bridge for file-based CRUD
- [monk-cli](../monk-cli) - Command-line interface
