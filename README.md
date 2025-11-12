# monk-irc

IRC protocol server backed by Monk API for persistent storage.

## Overview

This is an IRC server implementation that translates IRC protocol commands into HTTP API calls to a Monk API backend. All users, channels, messages, and memberships are stored in a PostgreSQL database via the Monk API's dynamic schema system.

## How It Works

### IRC Protocol → API Persistence

The server maintains a **hybrid state model**:

**In-Memory (Fast):**
- Active TCP connections
- Nickname → connection mapping
- Real-time channel membership (for message routing)

**Persistent (Monk API):**
- User profiles (`irc_users` schema)
- Channel definitions (`irc_channels` schema)
- Channel memberships (`irc_channel_members` schema)
- Message history (`irc_messages` schema)

This approach provides real-time IRC performance while persisting all data for history, reconnection, and multi-server scenarios.

### Data Flow Example: Sending a Message

1. Client sends: `PRIVMSG #channel :Hello world`
2. Server parses IRC protocol message
3. In-memory lookup finds all connections in `#channel`
4. Message broadcast to connected users immediately
5. **Asynchronously**: API call persists message to `irc_messages` table
6. On reconnect: Recent messages can be retrieved from database

### Monk API Integration

The server uses the Monk API's Data API endpoints (`/api/data/:schema`) for all persistence:

```typescript
// Creating a user
POST /api/data/irc_users
[{
  "nickname": "alice",
  "username": "~alice", 
  "realname": "Alice Smith",
  "hostname": "127.0.0.1",
  "registered_at": "2024-11-13T12:00:00Z",
  "last_seen": "2024-11-13T12:00:00Z"
}]

// Finding users by nickname (GET + filter in-memory)
GET /api/data/irc_users
// Returns all users, filtered by nickname in application code

// Updating last_seen
PUT /api/data/irc_users/{id}
{
  "last_seen": "2024-11-13T12:05:00Z"
}
```

### Search Strategy

The Monk API returns all records for a schema, so filtering happens in-memory:

```typescript
// api-client.ts
async findUserByNickname(nickname: string, jwtToken?: string): Promise<any> {
    const result = await this.callDataEndpoint('irc_users', 'GET', {}, jwtToken);
    if (result.data) {
        return result.data.filter((u: any) => u.nickname === nickname);
    }
    return [];
}
```

This is simple and works well for small-to-medium datasets. For large deployments, you'd want to add API-side filtering or indexing.

### Duplicate Prevention

Users are looked up before creation to prevent duplicates:

```typescript
// base-command.ts - persistUser()
const existingUsers = await this.apiClient.findUserByNickname(nickname, token);

if (existingUsers && existingUsers.length > 0) {
    // User exists - update their last_seen
    await this.apiClient.updateUser(existingUsers[0].id, { last_seen: ... });
} else {
    // Create new user
    await this.apiClient.createUser({ nickname, username, ... });
}
```

### Channel Membership Management

Channel membership uses a junction table pattern:

```typescript
// JOIN command flow:
1. Get or create channel in irc_channels
2. Add user to in-memory channel member set (for routing)
3. Store membership in irc_channel_members with channel_id + user_id

// PART/QUIT command flow:
1. Remove from in-memory set
2. Find membership record by channel_id + user_id
3. DELETE /api/data/irc_channel_members/{membership_id}
```

The server maintains referential integrity by cleaning up memberships on disconnect.

## Database Schema

The server uses 4 main schemas in Monk API:

### irc_users
```json
{
  "nickname": "string (unique)",
  "username": "string",
  "realname": "string", 
  "hostname": "string",
  "modes": "string",
  "registered_at": "datetime",
  "last_seen": "datetime"
}
```

### irc_channels
```json
{
  "name": "string (unique, #channel)",
  "topic": "string",
  "topic_set_by": "string",
  "topic_set_at": "datetime",
  "modes": "string",
  "created_at": "datetime"
}
```

### irc_channel_members
```json
{
  "channel_id": "uuid (fk to irc_channels)",
  "user_id": "uuid (fk to irc_users)",
  "nickname": "string (cached)",
  "modes": "string (@, +, etc)",
  "joined_at": "datetime"
}
```

### irc_messages
```json
{
  "from_user_id": "uuid (fk to irc_users)",
  "from_nickname": "string (cached)",
  "target": "string (#channel or nickname)",
  "target_type": "enum (channel, user)",
  "message": "string",
  "sent_at": "datetime"
}
```

All schemas automatically include `id`, `created_at`, `updated_at`, `trashed_at`, `deleted_at` from Monk API.

## Development with `monk` CLI

The `monk` CLI tool was heavily used during development:

### Initial Setup

```bash
# Create tenant and authenticate
monk auth register --tenant monk-irc --username admin

# Create schemas from JSON definitions
monk describe create irc_users < schemas/irc_users.json
monk describe create irc_channels < schemas/irc_channels.json
monk describe create irc_channel_members < schemas/irc_channel_members.json
monk describe create irc_messages < schemas/irc_messages.json

# Verify schemas
monk describe list
```

### Development Workflow

```bash
# Check current tenant and auth status
monk status

# List data during testing
monk data list irc_users
monk data list irc_channels
monk data list irc_messages

# Make authenticated API calls directly
monk curl GET /api/data/irc_users

# View API documentation
monk docs data
```

### JWT Token Management

The server requires a JWT token for API authentication:

```bash
# Get current token (expires in 24 hours by default)
monk auth token

# Copy to .env file
echo "MONK_JWT_TOKEN=$(monk auth token)" >> .env

# When expired, refresh by getting a new token
# (no explicit refresh - just get a new token after re-authenticating)
monk auth token
```

The token is used as a **service account** - all IRC operations use this single token rather than per-user tokens. This simplifies the implementation but means all users share the same API access level.

**Token Expiration**: Tokens expire after 24 hours (configurable in Monk API). When expired, the server will get 401 errors. Simply get a new token with `monk auth token` and restart the server.

## Configuration

Create a `.env` file:

```bash
IRC_PORT=6667
IRC_HOST=localhost
IRC_SERVER_NAME=irc.monk.local
MONK_API_URL=http://localhost:9001
MONK_JWT_TOKEN=eyJhbGc...  # Get from: monk auth token
NODE_ENV=development
```

## Running

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Start development server (auto-reload)
npm run dev

# Start production server
npm start
```

## Connecting

```bash
# With netcat
nc localhost 6667
NICK alice
USER alice 0 * :Alice Smith
JOIN #general
PRIVMSG #general :Hello!
QUIT

# With irssi
irssi -c localhost -p 6667 -n alice

# With any IRC client
Server: localhost
Port: 6667
Nickname: your_nickname
```

## Implementation Notes

### API Call Patterns

**Create Pattern** (POST with array):
```typescript
await this.callDataEndpoint('irc_users', 'POST', [{
    nickname: "alice",
    username: "~alice"
}], jwtToken);
// Returns: { success: true, data: [{ id: "...", nickname: "alice", ... }] }
```

**Read Pattern** (GET returns all):
```typescript
const result = await this.callDataEndpoint('irc_users', 'GET', {}, jwtToken);
// Returns: { success: true, data: [{ id: "...", ... }, ...] }
// Filter in memory: result.data.filter(u => u.nickname === 'alice')
```

**Update Pattern** (PUT to specific ID):
```typescript
await this.callDataEndpoint(`irc_users/${userId}`, 'PUT', {
    last_seen: new Date().toISOString()
}, jwtToken);
```

**Delete Pattern** (DELETE by ID):
```typescript
await this.callDataEndpoint(`irc_channel_members/${membershipId}`, 'DELETE', {}, jwtToken);
```

### Connection Lifecycle

1. **Connect**: TCP socket established, `IrcConnection` object created
2. **Register**: NICK + USER commands → user looked up/created in DB, `userId` stored in connection
3. **JOIN**: Channel created/retrieved, membership added to DB and in-memory
4. **Activity**: Messages routed in-memory, persisted to DB asynchronously
5. **Disconnect**: QUIT broadcast to channels, memberships removed from DB, connection cleaned up

### Error Handling

Most API errors are caught and logged but don't crash the connection:

```typescript
try {
    await this.apiClient.createChannel(...);
} catch (error) {
    console.error(`Failed to create channel:`, error);
    // Send IRC error to client
    this.sendReply(connection, '403', `${channelName} :Cannot create channel`);
}
```

This keeps the IRC server available even if the API has temporary issues.

### Line Buffering

IRC messages can arrive fragmented across TCP packets. The server uses a line buffer:

```typescript
connection.lineBuffer += data.toString();
const lines = connection.lineBuffer.split(/\r?\n/);
connection.lineBuffer = lines.pop() || ''; // Keep incomplete line

for (const line of lines) {
    // Process complete IRC message
}
```

## Implemented Commands

**Phase 1 (Core):**
- NICK, USER - Registration
- PING, QUIT - Connection management
- JOIN, PART - Channel membership
- PRIVMSG - Send messages

**Phase 2 (Compatibility):**
- NAMES - List channel members
- TOPIC - Get/set channel topic
- LIST - Browse all channels
- WHO - Query user info
- WHOIS - Detailed user info
- MODE - User/channel modes

Total: 13 commands with full RFC 1459/2812 compliance.

## Known Limitations

1. **In-Memory Filtering**: All database records are fetched and filtered in-memory. Works for small deployments but doesn't scale to thousands of users/channels.

2. **Single Server**: No server-to-server protocol. Can't distribute across multiple servers.

3. **Service Account Auth**: All operations use one JWT token. No per-user permissions from Monk API's ACL system.

4. **Simplified Modes**: MODE command has basic implementation. Full operator privileges and complex channel modes (bans, invite-only) not implemented.

5. **No Message History Replay**: When users join a channel, they don't see previous messages (though they're stored in the database).

## Future Enhancements

- Add API-side filtering with query parameters
- Implement per-user JWT tokens for proper ACL integration
- Add channel operator privileges (KICK, BAN, INVITE)
- Message history replay on JOIN
- SSL/TLS support
- Rate limiting and flood protection

## Project Structure

```
monk-irc/
├── src/
│   ├── index.ts              # Entry point
│   ├── lib/
│   │   ├── irc-server.ts     # Core server, connection handling
│   │   ├── base-command.ts   # Abstract command base class
│   │   ├── api-client.ts     # Monk API HTTP client
│   │   └── types.ts          # TypeScript interfaces
│   └── commands/             # IRC command handlers
│       ├── nick.ts, user.ts  # Registration
│       ├── join.ts, part.ts  # Channel operations
│       ├── privmsg.ts        # Messaging
│       ├── names.ts, list.ts # Discovery
│       ├── topic.ts, mode.ts # Management
│       └── who.ts, whois.ts  # User info
├── schemas/                  # Monk API schema definitions
└── bin/monk-irc             # CLI executable
```

## License

MIT
