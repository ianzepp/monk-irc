# PART Command

## Synopsis
```
PART <#channel> [:<message>]
```

## Description

Leave a channel voluntarily.

## Backend API Mapping

### Channel Cleanup

```javascript
channel.removeMember(user)
user.partChannel(channel)

if (channel.isEmpty()) {
  tenant.removeChannel(channelName)
}
```

Empty channels are automatically removed from tenant's channel registry.

### Broadcast

All channel members see:
```
:nick!user@host PART #channel :message
```

Including the parting user.

## Examples

```irc
# Leave with default message
PART #products
→ :you!user@tenant PART #products :you

# Leave with custom message
PART #products :Going to lunch
→ :you!user@tenant PART #products :Going to lunch

# Leave record channel
PART #products/config-123 :Done reviewing
→ Channel removed if you were the last member
```

## Comparison with Other Leave Methods

| Method | Initiated By | Message Format | Use Case |
|--------|-------------|----------------|----------|
| PART | User | `:user PART #ch :msg` | Voluntary leave |
| KICK | Channel op | `:op KICK #ch user :reason` | Forced removal |
| FORCEPART | Bot (with cap) | `:user PART #ch :reason` | Bot-driven workflow |
| QUIT | User | `:user QUIT :msg` | Disconnect from server |

## State Changes

1. User removed from Channel's member set
2. Channel removed from User's channel set
3. Connection's channels set updated
4. Empty channel deleted

## Use Cases

### Manual Leave
```
PART #products
→ User decides to leave discussion
```

### Channel Switch
```
PART #products :Moving to #products/new-record
JOIN #products/new-record
→ Navigate between related channels
```

## See Also
- [JOIN](JOIN.md) - Join a channel
- [FORCEPART](FORCEPART.md) - Bot-driven part
- [QUIT](QUIT.md) - Leave all channels and disconnect
