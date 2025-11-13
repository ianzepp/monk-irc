# monk-irc Pure Bridge Refactoring Plan

## Executive Summary

Refactor monk-irc from a standalone IRC server with private state storage to a **pure protocol bridge** that translates IRC protocol commands into monk-api HTTP calls. The bridge will be stateless (except for in-memory connection tracking) and support multi-tenant authentication.

## Current Architecture (v1)

**Problems:**
- Private schemas (irc_users, irc_channels, irc_messages, irc_channel_members)
- Single service account JWT token for all operations
- IRC-specific state storage rather than transparent bridging
- No per-user authentication or multi-tenancy support
- Not a true bridge - creates parallel data structures

**Current Flow:**
```
IRC Client → monk-irc → Private irc_* schemas → monk-api
```

## Target Architecture (v2)

**Goals:**
- Pure protocol translation (no private state)
- Per-user authentication via monk-api /auth/login
- Multi-tenant support through IRC USER command mapping
- Multi-server support (dev/testing/prod backends)
- Stateless bridge (only in-memory connection tracking)

**New Flow:**
```
IRC Client → monk-irc (bridge) → Native schemas → monk-api
```

## IRC Protocol Mapping

### Connection & Authentication

Standard IRC registration sequence:
```
NICK <nickname>
USER <username> <hostname> <servername> :<realname>
```

**Mapping to monk-api:**
```
NICK alice
USER root cli-test dev :Alice Smith
     │    │         │    │
     │    │         │    └─> Display name (IRC realname)
     │    │         └──────> API server identifier (dev/testing/prod)
     │    └────────────────> Tenant name
     └─────────────────────> API username
```

### Authentication Flow

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│ IRC Client  │         │  monk-irc   │         │  monk-api   │
└─────────────┘         └─────────────┘         └─────────────┘
      │                       │                       │
      │  NICK alice           │                       │
      ├──────────────────────>│                       │
      │                       │                       │
      │  USER root cli-test dev :Alice Smith          │
      ├──────────────────────>│                       │
      │                       │                       │
      │                       │  POST /auth/login     │
      │                       │  {tenant: "cli-test", │
      │                       │   username: "root"}   │
      │                       ├──────────────────────>│
      │                       │                       │
      │                       │  {jwt: "eyJhbGc..."}  │
      │                       │<──────────────────────┤
      │                       │                       │
      │                       │ [Store JWT in         │
      │                       │  connection.jwt]      │
      │                       │                       │
      │  :server 001 alice :Welcome...                │
      │<──────────────────────┤                       │
      │                       │                       │
      │  JOIN #users          │                       │
      ├──────────────────────>│                       │
      │                       │  GET /api/data/users  │
      │                       │  Authorization: Bearer JWT
      │                       ├──────────────────────>│
      │                       │                       │
      │                       │  {data: [...]}        │
      │                       │<──────────────────────┤
      │                       │                       │
      │  :alice JOIN #users   │                       │
      │  :server 353 alice = #users :alice bob        │
      │  :server 366 alice #users :End of NAMES       │
      │<──────────────────────┤                       │
```

### Channel → Schema Mapping

```
JOIN #users     → GET /api/data/users (with user's JWT)
JOIN #tasks     → GET /api/data/tasks (with user's JWT)
PART #users     → Remove from in-memory channel tracking
PRIVMSG #users :show all active users → monk-bot responds (if listening)
```

Channels represent **schema contexts** rather than IRC chat rooms:
- Joining a channel = declaring interest in a schema
- Channel membership tracked in-memory only (for routing)
- No persistent IRC state stored
- monk-bot can listen to channels and provide AI-assisted operations

### Private Messaging

```
PRIVMSG alice :hello   → In-memory routing to user "alice" if connected
                          (ephemeral, not persisted)
```

## Connection State

### In-Memory Connection Object

```typescript
interface IrcConnection {
  // Network
  socket: Socket;
  lineBuffer: string;

  // IRC Identity
  nickname: string;        // "alice" - IRC display name
  username: string;        // "root" - API username
  tenant: string;          // "cli-test" - API tenant
  serverName: string;      // "dev" - API server identifier
  realname: string;        // "Alice Smith" - display name

  // Authentication
  jwt: string;             // "eyJhbGc..." - from /auth/login
  apiUrl: string;          // "http://localhost:9001" - resolved from serverName

  // State
  registered: boolean;
  channels: Set<string>;   // In-memory channel membership
  lastActivity: Date;
}
```

### Server State

```typescript
interface IrcServerState {
  // Active connections only (no persistence)
  connections: Map<Socket, IrcConnection>;
  nicknameMap: Map<string, IrcConnection>;  // For routing
  channelMembers: Map<string, Set<IrcConnection>>;  // For broadcasts

  // Configuration
  apiServers: Map<string, string>;  // "dev" → "http://localhost:9001"
}
```

## Multi-Server Support

### Configuration

```env
# .env
IRC_PORT=6667
IRC_HOST=localhost
IRC_SERVER_NAME=irc.monk.local

# API Server Endpoints
API_SERVER_DEV=http://localhost:9001
API_SERVER_TESTING=http://localhost:3001
API_SERVER_PROD=https://api.monk.example.com
API_SERVER_DEFAULT=dev

NODE_ENV=development
```

### Server Resolution

```typescript
// Parse USER command
const serverName = parseServerName(userCommand) || config.defaultServer;

// Lookup API URL
const apiUrl = config.apiServers.get(serverName);
if (!apiUrl) {
  sendError(connection, 'Invalid server name');
  return;
}

// Authenticate to specific server
const jwt = await authenticateUser(apiUrl, tenant, username);

// Store per-connection
connection.apiUrl = apiUrl;
connection.jwt = jwt;
```

Users can connect to different API backends from the same IRC server:
```
# User A connects to dev
USER root cli-test dev :Alice

# User B connects to testing
USER admin acme-corp testing :Bob

# User C connects to prod
USER alice prod-tenant prod :Carol
```

## Command Translation

### Core Commands

**NICK** - Set nickname (IRC identity, not API)
- Store in connection.nickname
- Update nicknameMap
- No API call

**USER** - Register with API
- Parse: username, tenant, serverName, realname
- Call: POST /auth/login {tenant, username}
- Store JWT in connection.jwt
- Send IRC welcome messages (001, 002, 003, 004)

**JOIN #schema** - Subscribe to schema context
- Add to connection.channels
- Add connection to channelMembers[schema]
- Optionally: GET /api/data/schema (to show current data)
- Send: JOIN confirmation, NAMES list

**PART #schema** - Unsubscribe from schema
- Remove from connection.channels
- Remove from channelMembers[schema]
- Send: PART confirmation

**PRIVMSG #schema :message** - Send to channel
- Broadcast to all connections in channelMembers[schema]
- monk-bot (if listening) processes message and responds
- No direct API call (unless monk-bot executes operations)

**PRIVMSG nick :message** - Direct message
- Route to specific nickname (in-memory)
- Ephemeral (not persisted)

**QUIT** - Disconnect
- Remove from all channels
- Remove from nicknameMap
- Close socket
- No API call needed

### Information Commands

**NAMES #schema** - List channel members
- Return nicknames from channelMembers[schema]
- Send: 353 (names list), 366 (end of names)

**LIST** - List available channels
- Optionally: GET /api/describe/list (available schemas)
- Or: Return currently joined channels
- Send: 322 (list item), 323 (end of list)

**WHO #schema** - Query channel members
- Return info from channelMembers[schema]
- Send: 352 (WHO reply), 315 (end of WHO)

**WHOIS nick** - Query user info
- Lookup in nicknameMap
- Return IRC identity + tenant info
- Send: 311 (user info), 318 (end of WHOIS)

**TOPIC #schema** - Get/set channel topic
- Could map to schema description
- Or: In-memory only (ephemeral)
- Send: 332 (topic), 333 (topic metadata)

**MODE** - User/channel modes
- Minimal implementation (no persistence)
- Track basic modes in-memory

**PING/PONG** - Keepalive
- Standard IRC keepalive (no API interaction)

## Removed Components

### Schemas to Delete
- `schemas/irc_users.json`
- `schemas/irc_channels.json`
- `schemas/irc_messages.json`
- `schemas/irc_channel_members.json`

### Code to Refactor
- `src/lib/api-client.ts` - Remove IRC-specific methods, keep generic HTTP client
- All command handlers - Remove persistence logic, keep protocol handling
- `src/lib/irc-server.ts` - Simplify to pure bridge logic

### Configuration to Update
- Remove `MONK_JWT_TOKEN` (no service account)
- Add `API_SERVER_*` configuration
- Update README to reflect bridge architecture

## Implementation Phases

### Phase 1: Authentication Bridge (Critical Path)
**Goal:** Per-user auth with tenant support

- [ ] Update IrcConnection interface (jwt, apiUrl, tenant, username)
- [ ] Implement USER command → POST /auth/login flow
- [ ] Add API server configuration and resolution
- [ ] Store JWT per-connection
- [ ] Update welcome messages to reflect authenticated state
- [ ] Test: Connect with different tenants/users

**Success Criteria:**
- Users can connect with: `USER root cli-test dev :Alice`
- monk-irc calls /auth/login and stores JWT
- Different users have different JWTs (isolation)

### Phase 2: Channel/Schema Bridge (Core Functionality)
**Goal:** Channels map to schemas, operations use user JWT

- [ ] Refactor JOIN to map #channel → schema context
- [ ] Remove channel persistence (in-memory only)
- [ ] Update PRIVMSG to broadcast in-memory
- [ ] Test: JOIN #users, see connected users
- [ ] Test: Multiple users in same channel

**Success Criteria:**
- `JOIN #users` succeeds (no DB persistence)
- Messages broadcast to channel members
- Each user's operations use their own JWT

### Phase 3: Remove Private State (Clean Up)
**Goal:** Pure bridge, no IRC-specific schemas

- [ ] Delete schemas/ directory (irc_users, etc.)
- [ ] Remove all API client methods that write to irc_* schemas
- [ ] Remove setup scripts that create private tenant
- [ ] Update documentation

**Success Criteria:**
- No irc_* schemas exist
- No private monk-irc tenant needed
- Server runs with zero persistent state

### Phase 4: monk-bot Integration (AI Layer)
**Goal:** monk-bot connects as IRC user, provides AI assistance

- [ ] monk-bot connects to monk-irc with its own JWT
- [ ] monk-bot joins channels (#users, #tasks, etc.)
- [ ] monk-bot listens for messages and interprets intent
- [ ] monk-bot executes operations using its JWT
- [ ] monk-bot responds with results

**Success Criteria:**
- monk-bot visible as IRC user in NAMES
- User: "show all active users" → monk-bot responds with query results
- User: "create user alice" → monk-bot executes API call and confirms

### Phase 5: Enhanced Features (Nice-to-Have)
- [ ] Schema discovery (LIST shows available schemas from /api/describe/list)
- [ ] Rich schema info on JOIN (show field definitions)
- [ ] Better error messages (map API errors to IRC numerics)
- [ ] Rate limiting per connection
- [ ] SSL/TLS support
- [ ] Configurable channel prefixes (# for schemas, & for custom)

## monk-bot Integration Architecture

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│ IRC User    │         │  monk-irc   │         │  monk-api   │
│ (alice)     │         │             │         │             │
└─────────────┘         └─────────────┘         └─────────────┘
      │                       │                       │
      │  USER root cli-test dev :Alice                │
      │  [Gets JWT for cli-test:root]                 │
      │  JOIN #users          │                       │
      ├──────────────────────>│                       │
      │                       │                       │
┌─────────────┐               │                       │
│  monk-bot   │               │                       │
│             │               │                       │
└─────────────┘               │                       │
      │                       │                       │
      │  USER monk-bot-admin monk-bot-state dev :AI   │
      │  [Gets JWT for monk-bot-state:monk-bot-admin] │
      │  JOIN #users          │                       │
      ├──────────────────────>│                       │
      │                       │                       │
      │  [Both in #users]     │                       │
      │                       │                       │
Alice │  PRIVMSG #users :show all active users        │
      ├──────────────────────>│                       │
      │                       ├────────────────────┐  │
      │                       │  [Broadcast to all │  │
      │                       │   #users members]  │  │
      │                       │<───────────────────┘  │
      │<──────────────────────┤                       │
Bot   │<──────────────────────┤                       │
      │                       │                       │
      │  [monk-bot processes with AI]                 │
      │                       │                       │
Bot   │  PRIVMSG #users :Found 5 active users...     │
      ├──────────────────────>│  GET /api/data/users │
      │                       │  (with bot JWT)       │
      │                       ├──────────────────────>│
      │                       │<──────────────────────┤
      │                       ├────────────────────┐  │
      │                       │  [Broadcast response  │
      │                       │<───────────────────┘  │
Alice │<──────────────────────┤                       │
Bot   │<──────────────────────┤                       │
```

## Testing Strategy

### Unit Tests
- IRC protocol parsing (NICK, USER, JOIN, etc.)
- API server resolution logic
- JWT storage and retrieval
- Channel membership tracking

### Integration Tests
- Full auth flow (USER → /auth/login → JWT storage)
- Multi-user channel membership
- Message routing between users
- monk-bot connection and command processing

### Manual Testing
```bash
# Terminal 1: Start monk-irc
cd /Users/ianzepp/Workspaces/monk-irc
npm run dev

# Terminal 2: Connect as alice
nc localhost 6667
NICK alice
USER root cli-test dev :Alice Smith
JOIN #users
PRIVMSG #users :Hello!

# Terminal 3: Connect as monk-bot
nc localhost 6667
NICK monk-bot
USER monk-bot-admin monk-bot-state dev :AI Assistant
JOIN #users
# Should see alice's message
PRIVMSG #users :I'm here to help!

# Terminal 2: Should see monk-bot's message
```

## Migration Notes

### For Existing Users
- Old IRC history (irc_messages) will not be available
- Users must reconnect with new USER format (username tenant servername)
- No migration needed (fresh start with pure bridge)

### Backward Compatibility
- None - this is a breaking change
- Previous version was POC, this is production architecture
- Document migration in release notes

## Documentation Updates

### README.md
- Update architecture diagrams (remove private schemas)
- Document USER command format
- Explain channel = schema mapping
- Add monk-bot integration example
- Remove references to service account JWT

### POC.md
- Archive as historical reference
- Add note pointing to PROXY_PLAN.md

### New Docs
- API_INTEGRATION.md - How to authenticate, map channels, use JWT
- MONK_BOT_SETUP.md - How to connect monk-bot as IRC user

## Success Criteria

### Phase 1 Complete When:
- ✅ Users authenticate per-connection with monk-api
- ✅ Multiple tenants can connect simultaneously
- ✅ Each connection has isolated JWT
- ✅ API server selection works (dev/testing/prod)

### Phase 2 Complete When:
- ✅ JOIN #schema succeeds without DB persistence
- ✅ Messages broadcast to channel members
- ✅ PART, QUIT clean up in-memory state
- ✅ No writes to irc_* schemas

### Phase 3 Complete When:
- ✅ All irc_* schemas deleted
- ✅ No private monk-irc tenant needed
- ✅ monk-irc runs stateless (except RAM)

### Phase 4 Complete When:
- ✅ monk-bot connects as regular IRC user
- ✅ monk-bot joins channels and responds to queries
- ✅ Natural language "show users" → bot executes query → returns results
- ✅ Multi-user collaboration works (alice asks, bot answers)

### Overall Success:
- ✅ monk-irc is a pure protocol bridge
- ✅ No persistent state (only in-memory connections)
- ✅ Per-user authentication and authorization
- ✅ Multi-tenant support through USER command
- ✅ monk-bot provides AI-assisted operations via IRC
- ✅ Clean architecture that matches monk-ftp bridge pattern

## Timeline Estimate

- Phase 1 (Auth): ~2-3 hours
- Phase 2 (Channels): ~2-3 hours
- Phase 3 (Cleanup): ~1 hour
- Phase 4 (monk-bot): ~1-2 hours
- Phase 5 (Polish): ~2-3 hours

**Total: ~8-12 hours of focused development**

## Questions to Resolve

1. **Schema discovery**: Should LIST command call /api/describe/list to show available schemas?
2. **JOIN behavior**: Should joining a channel auto-query data, or just establish context?
3. **Private messages**: Store in a generic messages schema, or keep ephemeral?
4. **Channel operators**: Map to API permissions somehow, or ignore IRC ops concept?
5. **MOTD**: Show API server info, available tenants, or standard IRC welcome?

---

**Status**: Planning Complete - Ready for Implementation
**Author**: Claude Code
**Date**: 2025-11-13
