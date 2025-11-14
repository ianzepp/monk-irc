# WHOIS Command

## Synopsis
```
WHOIS <nickname>
```

## Description

Get detailed information about a user.

## Backend API Mapping

### User Lookup

```javascript
const targetUser = tenant.getUserByNickname(nickname)
```

**Tenant isolation:**
- Only shows users in same tenant
- Cannot WHOIS users in other tenants

### Information Returned

Pulls from User object:
```javascript
{
  nickname: user.getNickname(),
  username: user.getUsername(),
  hostname: user.getHostname(),
  realname: user.getRealname(),
  channels: user.getChannelNames(),
  server: serverName,
  idleSeconds: user.getIdleSeconds(),
  signonTime: user.getConnectedAt(),
  awayMessage: user.getAwayMessage()
}
```

## Response Format

```
311 RPL_WHOISUSER nick user host * :realname
319 RPL_WHOISCHANNELS nick :@#products +#users #orders
312 RPL_WHOISSERVER nick irc.monk.dev :monk-irc server
317 RPL_WHOISIDLE nick 120 1705234567 :seconds idle, signon time
301 RPL_AWAY nick :Away message (if away)
318 RPL_ENDOFWHOIS nick :End of WHOIS list
```

## Examples

```irc
WHOIS alice
← 311 alice alice 127.0.0.1 * :Alice Smith
← 319 alice :@#products +#orders
← 312 alice irc.monk.dev :monk-irc server
← 317 alice 45 1705234567 :seconds idle, signon time
← 318 alice :End of WHOIS list
```

## Channel Roles

Shows channel prefixes in RPL_WHOISCHANNELS:
- `@#channel` - Operator
- `+#channel` - Voice
- `#channel` - Regular member

## Idle Tracking

```javascript
idleSeconds = Math.floor((now - user.getLastActivity()) / 1000)
```

Activity updated on:
- Sending PRIVMSG/NOTICE
- JOIN/PART/TOPIC
- Connection events

## Use Cases

### User Discovery
```
WHOIS alice
→ See what channels alice is in
→ Check if alice is away
```

### Debugging
```
WHOIS bot
→ Verify bot's access level
→ See bot's current channels
```

## Privacy

Only returns information for users in same tenant - maintains tenant isolation.

## See Also
- [WHO](WHO.md) - List users in channel
- [AWAY](AWAY.md) - Set away status
