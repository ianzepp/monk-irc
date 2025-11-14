# PRIVMSG Command

## Synopsis
```
PRIVMSG <#channel> :<message>
PRIVMSG <nickname> :<message>
```

## Description

Send a message to a channel or user. Primary communication command in IRC.

## Backend API Mapping

### Channel Messages

**No API persistence:**
- Messages are NOT stored in monk-api
- Messages are only routed to connected users
- monk-irc is a bridge/gateway, not a message store

**Routing:**
```javascript
// Channel message
const channel = tenant.getChannel(channelName)
channel.broadcast(`:sender PRIVMSG ${channelName} :${message}`, sender)
```

**Permission Check:**
```javascript
if (!channel.canSendMessage(sender)) {
  // User not in channel (+n mode)
  // OR channel is moderated (+m) and user has no voice/op
  return 'Cannot send to channel'
}
```

### Private Messages

**Direct user-to-user:**
```javascript
const targetUser = tenant.getUserByNickname(targetNick)
targetUser.sendMessage(`:sender PRIVMSG ${targetNick} :${message}`)
```

**Tenant isolation:**
- Can only message users in same tenant
- No cross-tenant messaging

### Tenant-Aware Routing

For connections with `tenant-aware` capability:

```javascript
// Message sent to #products@system
// Routes to users in 'system' tenant's #products channel
```

Used by bots to send messages across tenant boundaries.

## Channel Context

When messaging in `#schema` or `#schema/recordId` channels:
- Message happens in context of that data
- Bot can reference the schema/record being discussed
- No automatic API updates (messages are ephemeral)

## Examples

```irc
# Channel message
PRIVMSG #products :Has anyone reviewed the new schema?
→ All users in #products see the message

# Private message
PRIVMSG alice :Can you check the config record?
→ Only alice sees the message

# Record-specific discussion
JOIN #products/config-123
PRIVMSG #products/config-123 :This field looks incorrect
→ Discussion about specific record
```

## Message Routing Flow

1. Parse target (channel or user)
2. Get tenant context
3. Validate sender permissions
4. If channel:
   - Check channel membership (+n mode)
   - Check moderation status (+m mode)
   - Broadcast to channel members
5. If user:
   - Find user in same tenant
   - Send direct message

## See Also
- [NOTICE](NOTICE.md) - Similar but doesn't trigger auto-replies
- [JOIN](JOIN.md) - Join channels for messaging
- [CAP](CAP.md) - Tenant-aware capability
