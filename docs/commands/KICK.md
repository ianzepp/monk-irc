# KICK Command

## Synopsis
```
KICK <#channel> <nickname> [:<reason>]
```

## Description

Remove a user from a channel forcefully. Requires channel operator status or API permissions.

## Backend API Mapping

### Permission Check

**Channel operator:**
```javascript
if (channel.canKick(kicker)) {
  // User has @ status in channel
  return true
}
```

**API-based permission (for schema channels):**
```
GET /api/describe/schema/{schema}
```

**Response:**
```json
{
  "data": {
    "access": "root",
    "permissions": {
      "write": true,
      "delete": true
    }
  }
}
```

**Permission logic:**
```javascript
if (access === 'root' || access === 'full' || access === 'edit') {
  return true
}
if (permissions.write || permissions.delete) {
  return true
}
```

Users with edit/delete permissions on a schema can KICK from that schema's channels.

## Channel Cleanup

After KICK:
```javascript
channel.removeMember(targetUser)
targetUser.partChannel(channel)

if (channel.isEmpty()) {
  tenant.removeChannel(channelName)
}
```

Empty channels are automatically removed.

## Examples

```irc
# Channel operator kicks user
KICK #products alice :Off-topic discussion
→ :kicker!user@tenant KICK #products alice :Off-topic discussion

# API-based kick (edit access to schema)
KICK #products/config-123 bob :Session expired
→ Bob removed if kicker has edit access to 'products'

# Simple kick
KICK #general alice
→ Default reason: "Kicked by nickname"
```

## Broadcast

Everyone in the channel sees:
```
:kicker!user@host KICK #channel target :reason
```

Including the kicked user (before they're removed).

## Comparison with FORCEPART

| Command | Appearance | Permission | Use Case |
|---------|-----------|------------|----------|
| KICK | `:kicker KICK #ch user :reason` | Channel op or API permission | Moderation, rules enforcement |
| FORCEPART | `:user PART #ch :reason` | force-part cap + root/full | Polite removal, workflow |

## Access Control Hierarchy

1. **Channel creator** (first user) - Always operator
2. **Global root/full** - Operator in all channels
3. **Edit access to schema** - Can kick from schema channels
4. **Regular members** - Cannot kick

## See Also
- [FORCEPART](FORCEPART.md) - Polite alternative
- [MODE](MODE.md) - Manage channel modes
- [JOIN](JOIN.md) - Channel access control
