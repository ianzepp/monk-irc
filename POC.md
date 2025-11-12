# monk-irc - IRC Server Protocol Implementation

## Executive Summary

**IRC Protocol Bridge** - Standalone TypeScript IRC server providing traditional IRC client compatibility with the Monk API PaaS platform, acting as a protocol translation layer between legacy IRC clients and modern HTTP APIs.

### Project Overview
- **Language**: TypeScript/Node.js with custom IRC protocol implementation
- **Purpose**: IRC protocol server for Monk API integration and legacy client compatibility
- **Architecture**: Protocol translation bridge converting IRC commands to HTTP API calls
- **Integration**: Seamless bridge between IRC clients and Monk API backend
- **Design**: Command-based architecture with individual IRC command handlers

### Inspiration

This project mirrors the successful **monk-ftp** architecture, which implements an FTP protocol server that translates FTP commands to Monk API calls. The same patterns apply beautifully to IRC:

| **FTP Concept** | **IRC Equivalent** |
|-----------------|-------------------|
| USER/PASS authentication | NICK/USER registration |
| Current directory state | Joined channels list |
| File operations (LIST, STOR, RETR) | Channel operations (JOIN, PART, PRIVMSG) |
| Data connections | Message routing |
| FTP response codes (220, 230, 550) | IRC numeric replies (001, 332, 433) |
| Path management | Channel/user targeting |

## Architecture Design

### Project Structure

```
monk-irc/
├── src/
│   ├── index.ts              # Main entry point
│   ├── lib/
│   │   ├── irc-server.ts     # Core IRC server (like ftp-server.ts)
│   │   ├── base-command.ts   # Abstract command handler
│   │   ├── api-client.ts     # HTTP client for Monk API
│   │   ├── types.ts          # TypeScript interfaces
│   │   └── message-router.ts # Message routing logic
│   └── commands/             # IRC command handlers
│       ├── nick.ts           # NICK command
│       ├── user.ts           # USER command
│       ├── join.ts           # JOIN command
│       ├── part.ts           # PART command
│       ├── privmsg.ts        # PRIVMSG command
│       ├── quit.ts           # QUIT command
│       ├── ping.ts           # PING command
│       ├── pong.ts           # PONG command
│       ├── mode.ts           # MODE command
│       ├── topic.ts          # TOPIC command
│       └── ...               # More IRC commands
├── spec/
│   ├── unit/                 # Unit tests (vitest)
│   └── helpers/              # Test helpers, fake API
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### Core Types

```typescript
// src/lib/types.ts

export interface IrcConnection {
    socket: net.Socket;
    id: string;

    // Registration state
    nickname?: string;
    username?: string;
    realname?: string;
    hostname: string;
    registered: boolean;

    // Authentication (optional)
    authenticated: boolean;
    jwtToken?: string;

    // Channel membership (in-memory for routing)
    channels: Set<string>;  // #channel-name

    // User modes
    modes: Set<string>;     // +i, +w, etc.

    // Connection metadata
    connectedAt: Date;
    lastActivity: Date;
}

export interface IrcCommandHandler {
    readonly name: string;
    readonly needsRegistration: boolean;  // Like needsAuth in FTP

    execute(connection: IrcConnection, args: string): Promise<void>;
}

export interface ServerConfig {
    port: number;
    host: string;
    serverName: string;      // irc.monk.local
    apiUrl: string;          // http://localhost:9001
    debug: boolean;
}
```

### IRC Numeric Replies

Following RFC 1459/2812 standards:

```typescript
export const IRC_REPLIES = {
    // Welcome messages (001-004)
    RPL_WELCOME: '001',           // Welcome to the network
    RPL_YOURHOST: '002',          // Your host is...
    RPL_CREATED: '003',           // Server created...
    RPL_MYINFO: '004',            // Server info

    // Channel operations
    RPL_NOTOPIC: '331',           // No topic set
    RPL_TOPIC: '332',             // Channel topic
    RPL_NAMREPLY: '353',          // Names list
    RPL_ENDOFNAMES: '366',        // End of names

    // WHOIS replies
    RPL_WHOISUSER: '311',         // User info
    RPL_ENDOFWHOIS: '318',        // End of WHOIS

    // Errors
    ERR_NOSUCHNICK: '401',        // No such nick/channel
    ERR_NOSUCHCHANNEL: '403',     // No such channel
    ERR_CANNOTSENDTOCHAN: '404',  // Cannot send to channel
    ERR_TOOMANYCHANNELS: '405',   // Too many channels
    ERR_NORECIPIENT: '411',       // No recipient
    ERR_NOTEXTTOSEND: '412',      // No text to send
    ERR_UNKNOWNCOMMAND: '421',    // Unknown command
    ERR_NONICKNAMEGIVEN: '431',   // No nickname given
    ERR_ERRONEUSNICKNAME: '432',  // Erroneous nickname
    ERR_NICKNAMEINUSE: '433',     // Nickname in use
    ERR_NOTREGISTERED: '451',     // Not registered
    ERR_NEEDMOREPARAMS: '461',    // Need more params
    ERR_ALREADYREGISTERED: '462', // Already registered
} as const;
```

## Monk API Schema Design

### Schema Definitions

#### irc_users
User profiles and registration information.

```json
{
  "type": "object",
  "title": "IRC Users",
  "required": ["id", "nickname", "username", "realname"],
  "properties": {
    "nickname": {
      "type": "string",
      "minLength": 1,
      "maxLength": 30,
      "pattern": "^[a-zA-Z][a-zA-Z0-9_\\-\\[\\]\\{\\}\\\\`\\|]*$",
      "description": "Current nickname (indexed for uniqueness)"
    },
    "username": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100,
      "description": "IRC username (~user)"
    },
    "realname": {
      "type": "string",
      "minLength": 1,
      "maxLength": 255,
      "description": "Real name or description"
    },
    "hostname": {
      "type": "string",
      "description": "User hostname or IP"
    },
    "modes": {
      "type": "string",
      "default": "",
      "description": "User modes: +iw, etc."
    },
    "registered_at": {
      "type": "string",
      "format": "date-time",
      "description": "Registration timestamp"
    },
    "last_seen": {
      "type": "string",
      "format": "date-time",
      "description": "Last activity timestamp"
    }
  }
}
```

#### irc_channels
Channel definitions and metadata.

```json
{
  "type": "object",
  "title": "IRC Channels",
  "required": ["id", "name"],
  "properties": {
    "name": {
      "type": "string",
      "pattern": "^#[a-zA-Z0-9_\\-]+$",
      "minLength": 2,
      "maxLength": 50,
      "description": "Channel name (indexed for uniqueness)"
    },
    "topic": {
      "type": "string",
      "maxLength": 500,
      "default": "",
      "description": "Channel topic"
    },
    "topic_set_by": {
      "type": "string",
      "description": "Nickname who set the topic"
    },
    "topic_set_at": {
      "type": "string",
      "format": "date-time",
      "description": "When topic was set"
    },
    "modes": {
      "type": "string",
      "default": "+nt",
      "description": "Channel modes"
    },
    "created_at": {
      "type": "string",
      "format": "date-time",
      "description": "Channel creation timestamp"
    }
  }
}
```

#### irc_channel_members
Tracks which users are in which channels.

```json
{
  "type": "object",
  "title": "IRC Channel Members",
  "required": ["id", "channel_id", "user_id"],
  "properties": {
    "channel_id": {
      "type": "string",
      "format": "uuid",
      "description": "Reference to irc_channels.id"
    },
    "user_id": {
      "type": "string",
      "format": "uuid",
      "description": "Reference to irc_users.id"
    },
    "nickname": {
      "type": "string",
      "description": "Cached nickname for fast lookups"
    },
    "modes": {
      "type": "string",
      "default": "",
      "description": "Channel-specific modes: @, +, etc."
    },
    "joined_at": {
      "type": "string",
      "format": "date-time",
      "description": "When user joined channel"
    }
  }
}
```

#### irc_messages
Message history for channels and private messages.

```json
{
  "type": "object",
  "title": "IRC Messages",
  "required": ["id", "from_user_id", "target", "message"],
  "properties": {
    "from_user_id": {
      "type": "string",
      "format": "uuid",
      "description": "Reference to irc_users.id"
    },
    "from_nickname": {
      "type": "string",
      "description": "Cached nickname for display"
    },
    "target": {
      "type": "string",
      "description": "Channel name (#channel) or nickname (privmsg)"
    },
    "target_type": {
      "type": "string",
      "enum": ["channel", "user"],
      "description": "Message destination type"
    },
    "message": {
      "type": "string",
      "maxLength": 512,
      "description": "Message content"
    },
    "sent_at": {
      "type": "string",
      "format": "date-time",
      "description": "Message timestamp"
    }
  }
}
```

## Key Design Decisions

### 1. Hybrid State Management

**In-Memory State:**
- Active TCP connections
- Real-time message routing
- Current channel membership for connected users
- Nickname → connection mapping

**Persistent State (Monk API):**
- User profiles and registration
- Channel definitions
- Channel membership history
- Message history
- User/channel metadata

**Rationale:** IRC is inherently real-time, so we need in-memory state for fast message routing. But we persist everything to the API for history, reconnection, and multi-server scenarios.

### 2. Authentication Strategy

**Optional JWT-based authentication:**
- NICK/USER registration works without auth (for public use)
- Optional PASS command accepts JWT token
- Authenticated users get persistent profile
- Unauthenticated users are ephemeral (connection-only)

**Benefits:**
- Supports traditional IRC "anonymous" usage
- Enables authenticated users with persistent history
- Compatible with Monk API security model

### 3. Message Routing

**Real-time routing:**
- Incoming PRIVMSG → Parse target → Find connection(s) → Send directly
- Channel messages → Broadcast to all members with active connections
- Use in-memory maps for O(1) lookups

**Persistent storage:**
- All messages stored in Monk API (irc_messages schema)
- Enables history playback
- Supports offline message delivery (future)

### 4. IRC Protocol Compliance

Following RFC 1459 (original IRC) and RFC 2812 (updates):

**Phase 1 Commands (MVP):**
- NICK - Set nickname
- USER - Set username/realname
- PING/PONG - Connection keepalive
- JOIN - Join channel
- PART - Leave channel
- PRIVMSG - Send message
- QUIT - Disconnect

**Phase 2 Commands:**
- TOPIC - Get/set channel topic
- NAMES - List channel members
- WHO - Query user info
- WHOIS - Detailed user info
- MODE - User/channel modes
- LIST - List channels

**Phase 3 Commands:**
- KICK - Remove user from channel
- INVITE - Invite user to channel
- NOTICE - Send notice
- AWAY - Set away status

## Implementation Phases

### Phase 1: Minimal Viable IRC Server

**Goal:** Basic IRC server that clients can connect to and chat.

**Features:**
- TCP socket server on port 6667
- Connection registration (NICK, USER)
- Channel operations (JOIN, PART, PRIVMSG)
- Basic message routing
- PING/PONG keepalive
- QUIT handling

**Monk API Integration:**
- Create schemas (irc_users, irc_channels, irc_channel_members, irc_messages)
- Store user registrations
- Store channels and membership
- Log all messages

**Success Criteria:**
- Connect with `irssi` or `weechat`
- Register with NICK/USER
- JOIN a channel
- Send messages that other users see
- See messages from other users

### Phase 2: IRC Client Compatibility

**Goal:** Full compatibility with popular IRC clients.

**Features:**
- Complete numeric reply support
- TOPIC command
- NAMES list on JOIN
- WHO/WHOIS commands
- LIST channels
- Proper error handling

**Monk API Integration:**
- Channel metadata (topic, modes)
- User metadata (modes, realname)
- Message history queries

**Success Criteria:**
- Works with irssi, weechat, HexChat, mIRC
- Proper channel topic display
- Names list shows all members
- WHOIS returns user info

### Phase 3: Advanced Features

**Goal:** Full-featured IRC server with moderation and features.

**Features:**
- Channel modes (+n, +t, +m, +i, +k, +l)
- User modes (+i, +w, +o)
- Channel operators (@, +)
- KICK, BAN, INVITE
- Private channels
- Channel keys (passwords)
- Message history playback

**Monk API Integration:**
- Mode storage and enforcement
- Ban lists
- Invite-only channel tracking
- History playback API

**Success Criteria:**
- Full IRC feature parity
- Channel moderation works
- Private channels functional
- History playback on join

## Development Workflow

### Setup

```bash
# Initialize project
npm install

# Compile TypeScript
npm run compile

# Create Monk API tenant
monk auth register --tenant monk-irc --username admin

# Create IRC schemas
monk describe create irc_users < schemas/irc_users.json
monk describe create irc_channels < schemas/irc_channels.json
monk describe create irc_channel_members < schemas/irc_channel_members.json
monk describe create irc_messages < schemas/irc_messages.json
```

### Development

```bash
# Start development server with auto-reload
npm run dev

# Test with netcat
echo "NICK testuser\r\nUSER test 0 * :Test User\r\n" | nc localhost 6667

# Test with IRC client
irssi -c localhost -p 6667 -n testuser

# Run unit tests
npm run spec:ts
```

### Testing

```bash
# Unit tests
npm run spec:ts

# Integration tests
npm run spec:sh

# Manual testing with various clients
irssi -c localhost -p 6667
weechat -r "/server add local localhost/6667; /connect local"
hexchat
```

## Technical Patterns (from monk-ftp)

### Command Handler Pattern

```typescript
// src/commands/join.ts
import { BaseIrcCommand } from '../lib/base-command.js';
import type { IrcConnection } from '../lib/types.js';

export class JoinCommand extends BaseIrcCommand {
    readonly name = 'JOIN';
    readonly needsRegistration = true;

    async execute(connection: IrcConnection, args: string): Promise<void> {
        if (!args) {
            this.sendReply(connection, '461', 'JOIN :Not enough parameters');
            return;
        }

        const channelName = args.split(' ')[0];

        // Validate channel name
        if (!channelName.startsWith('#')) {
            this.sendReply(connection, '403', `${channelName} :No such channel`);
            return;
        }

        // Get or create channel via API
        const channel = await this.apiClient.getOrCreateChannel(
            channelName,
            connection.jwtToken
        );

        // Add user to channel
        await this.apiClient.joinChannel(
            channel.id,
            connection.nickname!,
            connection.jwtToken
        );

        // Update in-memory state
        connection.channels.add(channelName);

        // Send JOIN confirmation
        this.sendMessage(
            connection,
            `:${connection.nickname}!${connection.username}@${connection.hostname} JOIN ${channelName}`
        );

        // Send topic
        if (channel.topic) {
            this.sendReply(connection, '332', `${channelName} :${channel.topic}`);
        }

        // Send names list
        const members = await this.apiClient.getChannelMembers(
            channel.id,
            connection.jwtToken
        );
        this.sendReply(connection, '353', `= ${channelName} :${members.join(' ')}`);
        this.sendReply(connection, '366', `${channelName} :End of /NAMES list`);

        // Broadcast JOIN to other channel members
        this.broadcastToChannel(channelName, connection,
            `:${connection.nickname}!${connection.username}@${connection.hostname} JOIN ${channelName}`
        );
    }
}
```

### Base Command Class

```typescript
// src/lib/base-command.ts
export abstract class BaseIrcCommand implements IrcCommandHandler {
    protected apiClient: MonkApiClient;
    protected debug: boolean;

    constructor(apiUrl: string, debug: boolean = false) {
        this.apiClient = new MonkApiClient(apiUrl, debug);
        this.debug = debug;
    }

    abstract readonly name: string;
    abstract readonly needsRegistration: boolean;

    abstract execute(connection: IrcConnection, args: string): Promise<void>;

    protected sendReply(connection: IrcConnection, code: string, message: string): void {
        const response = `:${this.serverName} ${code} ${connection.nickname || '*'} ${message}\r\n`;
        connection.socket.write(response);
    }

    protected sendMessage(connection: IrcConnection, message: string): void {
        const response = `${message}\r\n`;
        connection.socket.write(response);
    }
}
```

### Server Main Loop

```typescript
// src/lib/irc-server.ts
export class IrcServer {
    private server: net.Server;
    private connections = new Map<string, IrcConnection>();
    private nicknameToConnection = new Map<string, IrcConnection>();
    private channelMembers = new Map<string, Set<IrcConnection>>();
    private commandHandlers = new Map<string, IrcCommandHandler>();

    async start(): Promise<void> {
        await this.loadCommandHandlers();

        return new Promise((resolve) => {
            this.server.listen(this.config.port, this.config.host, () => {
                console.log(`IRC server listening on ${this.config.host}:${this.config.port}`);
                resolve();
            });
        });
    }

    private handleConnection(socket: net.Socket): void {
        const connection: IrcConnection = {
            socket,
            id: crypto.randomUUID(),
            hostname: socket.remoteAddress || 'unknown',
            registered: false,
            authenticated: false,
            channels: new Set(),
            modes: new Set(),
            connectedAt: new Date(),
            lastActivity: new Date()
        };

        this.connections.set(connection.id, connection);

        socket.on('data', (data) => this.handleData(connection, data));
        socket.on('close', () => this.handleClose(connection));
        socket.on('error', (err) => this.handleError(connection, err));
    }

    private async handleData(connection: IrcConnection, data: Buffer): Promise<void> {
        const lines = data.toString().split('\r\n');

        for (const line of lines) {
            if (!line.trim()) continue;

            const [command, ...args] = line.trim().split(' ');
            const handler = this.commandHandlers.get(command.toUpperCase());

            if (!handler) {
                this.sendReply(connection, '421', `${command} :Unknown command`);
                continue;
            }

            if (handler.needsRegistration && !connection.registered) {
                this.sendReply(connection, '451', ':You have not registered');
                continue;
            }

            await handler.execute(connection, args.join(' '));
        }
    }
}
```

## Success Metrics

### Phase 1 Success
- [ ] IRC server starts on port 6667
- [ ] Clients can connect with netcat/telnet
- [ ] NICK/USER registration works
- [ ] Can JOIN a channel
- [ ] Can send PRIVMSG to channel
- [ ] Other users in channel see messages
- [ ] All operations persist to Monk API

### Phase 2 Success
- [ ] Works with irssi/weechat/HexChat
- [ ] Channel topic displays correctly
- [ ] Names list shows on JOIN
- [ ] WHO/WHOIS return info
- [ ] LIST shows available channels
- [ ] Private messages work

### Phase 3 Success
- [ ] Channel modes work (+n, +t, +m)
- [ ] User modes work (+i, +w, +o)
- [ ] Can set channel operators
- [ ] KICK/BAN functionality
- [ ] Private channels with keys
- [ ] History playback on reconnect

## Future Enhancements

### Multi-Server Support
- Server-to-server protocol
- Distributed channel state
- Cross-server message routing

### Advanced Features
- Services (NickServ, ChanServ)
- Channel logging
- Spam protection
- Flood control
- SSL/TLS support

### Modern Integrations
- Webhooks for external notifications
- Bot API for automated responses
- REST API for channel management
- WebSocket bridge for web clients

---

**Status:** POC Design Phase
**Next Steps:** Initialize project, create schemas, build Phase 1 MVP
**Target:** Working IRC server with basic channel chat functionality
