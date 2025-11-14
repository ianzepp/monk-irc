# monk-irc Command Reference

IRC commands and their mapping to the monk-api backend architecture.

## Core Architecture

monk-irc bridges IRC protocol to monk-api schemas and records:
- **Channels** = Schemas (`#schema`) or Records (`#schema/recordId`)
- **Users** = monk-api users with tenant association
- **Roles** = Based on API access levels (root, full, edit, read)
- **Messages** = Ephemeral (not stored, only routed)

## Authentication & Setup

| Command | Description | API Integration |
|---------|-------------|-----------------|
| [CAP](CAP.md) | Capability negotiation | IRCv3 + monk-irc extensions |
| [NICK](NICK.md) | Set nickname, authenticate | `POST /auth/login` |
| [USER](USER.md) | Set username, authenticate | `POST /auth/login` |

## Channel Operations

| Command | Description | API Integration |
|---------|-------------|-----------------|
| [JOIN](JOIN.md) | Join schema/record channel | `GET /api/data/{schema}[/{id}]` |
| [PART](PART.md) | Leave channel | In-memory only |
| [TOPIC](TOPIC.md) | View/set channel topic | Schema info from API |
| [LIST](LIST.md) | List available channels | `GET /api/describe/schemas` |
| [NAMES](NAMES.md) | List channel members | In-memory |
| [MODE](MODE.md) | View channel/user modes | In-memory |

## Messaging

| Command | Description | API Integration |
|---------|-------------|-----------------|
| [PRIVMSG](PRIVMSG.md) | Send message to channel/user | Ephemeral, not stored |
| [NOTICE](NOTICE.md) | Send notice (no auto-reply) | Ephemeral, not stored |
| [WALLOPS](WALLOPS.md) | Broadcast to all tenant users | Ephemeral |

## User Information

| Command | Description | API Integration |
|---------|-------------|-----------------|
| [WHOIS](WHOIS.md) | Detailed user information | User object |
| [WHO](WHO.md) | List users in channel | User/Channel objects |
| [AWAY](AWAY.md) | Set away status | In-memory |

## Channel Management

| Command | Description | API Integration |
|---------|-------------|-----------------|
| [KICK](KICK.md) | Remove user from channel | `GET /api/describe/schema/{schema}` |
| [INVITE](INVITE.md) | Invite user to channel | In-memory |

## monk-irc Extensions

Advanced capabilities requiring bot service access:

| Command | Capability | Description |
|---------|-----------|-------------|
| [FORCEJOIN](FORCEJOIN.md) | `force-join` | Force user into channel |
| [FORCEPART](FORCEPART.md) | `force-part` | Politely remove user |

## Access Level Mapping

User's API access level determines IRC channel roles:

```
root/full  →  Operator (@)  - Full channel control
edit       →  Voice (+)      - Can speak when moderated
read       →  Member         - Basic access
```

Access level returned from `POST /auth/login`:
```json
{
  "data": {
    "token": "jwt...",
    "access": "root"
  }
}
```

## Channel Format

### Schema Channels
```
#products  →  Schema "products" in monk-api
#users     →  Schema "users" in monk-api
#orders    →  Schema "orders" in monk-api
```

### Record Channels
```
#products/config-123   →  Record "config-123" in "products" schema
#users/alice           →  Record "alice" in "users" schema
#orders/ORD-2024-001   →  Record "ORD-2024-001" in "orders" schema
```

## Tenant Isolation

All operations are tenant-scoped:
- Users only see users in their tenant
- Channels are per-tenant
- Messages cannot cross tenant boundaries
- LIST shows only accessible schemas

Exception: `tenant-aware` capability for bot services managing multiple tenants.

## Standard IRC Commands

For completeness, standard IRC commands with minimal API integration:

- **PING/PONG** - Connection keepalive
- **QUIT** - Disconnect from server
- **VERSION** - Server version info
- **MOTD** - Message of the day
- **HELP** - Command help
- **INFO** - Server information
- **TIME** - Server time
- **STATS** - Server statistics
- **ISON** - Check if users online
- **USERHOST** - Get user hostname

These commands work with in-memory state only and don't query the API backend.

## Bot Service Workflow

Typical bot service setup:

```irc
# 1. Negotiate capabilities
CAP REQ :tenant-aware force-join force-part

# 2. Authenticate with root/full access
NICK bot@system

# 3. Monitor channels or respond to PRIVMSG

# 4. Force-join users for workflows
FORCEJOIN alice #products/config-123

# 5. Clean up when done
FORCEPART #products/config-123 alice :Task complete
```

## See Also

- [monk-api Documentation](https://github.com/your-org/monk-api) - Backend API reference
- [IRCv3 Specifications](https://ircv3.net/) - IRC protocol extensions
