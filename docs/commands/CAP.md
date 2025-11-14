# CAP Command

## Synopsis
```
CAP LS [302]
CAP REQ :<capability1> <capability2> ...
CAP LIST
CAP END
```

## Description

IRCv3 capability negotiation. Enables extended features beyond standard IRC.

## Available Capabilities

### Standard IRCv3 Capabilities

**`multi-prefix`**
- Shows multiple role prefixes (e.g., `@+nick` for operator with voice)
- Standard IRC capability

**`server-time`**
- Adds timestamp tags to messages
- Format: `@time=2025-01-14T12:34:56.789Z`

**`away-notify`**
- Notifies when users in shared channels go away/return
- Reduces need for WHOIS queries

**`extended-join`**
- JOIN messages include account and realname
- Format: `:nick!user@host JOIN #channel accountname :realname`

**`invite-notify`**
- Broadcasts INVITE notifications to channel members
- Users with this cap see when others are invited

### monk-irc Specific Capabilities

**`tenant-aware`**
- Enables multi-tenant messaging features
- Receives TENANTS, TENANTJOIN, TENANTPART notifications
- Messages forwarded with `#channel@tenant` format
- Can send NOTICE with `#channel@tenant` routing
- Intended for bot services that manage multiple tenants

**`force-join`**
- Grants ability to use FORCEJOIN command
- Requires `root` or `full` access level
- Allows force-joining users into channels
- Used by bots to pull users into conversations

**`force-part`**
- Grants ability to use FORCEPART command
- Requires `root` or `full` access level
- Allows polite removal (PART vs KICK) of users
- Used by bots for graceful conversation cleanup

## Backend API Mapping

Capabilities are stored in:
- User object's `capabilities` Set
- Connection object's `capabilities` Set

No direct API interaction, but `force-join` and `force-part` require access level validation from login.

## Usage Examples

### Bot Service (with special capabilities)
```irc
CAP REQ :tenant-aware force-join force-part
→ Enables bot to manage users across channels
```

### Standard Client
```irc
CAP REQ :multi-prefix server-time away-notify
→ Enhances user experience with timestamps and notifications
```

### Capability Discovery
```irc
CAP LS 302
← CAP * LS :multi-prefix tenant-aware server-time away-notify extended-join invite-notify force-join force-part
```

## Negotiation Flow

1. Client connects
2. `CAP LS` - Server lists available capabilities
3. `CAP REQ :cap1 cap2` - Client requests specific capabilities
4. `CAP ACK :cap1 cap2` - Server acknowledges
5. `CAP END` - Client ends negotiation, registration continues

## See Also
- [FORCEJOIN](FORCEJOIN.md) - Force-join capability usage
- [FORCEPART](FORCEPART.md) - Force-part capability usage
