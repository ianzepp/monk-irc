# WALLOPS Command

## Synopsis
```
WALLOPS :<message>
```

## Description

Broadcast a message to all users in your tenant. Intended for system-wide announcements.

## Requirements

- **Access Level:** Must have `root` or `full` access level
- **Capability:** No special capability required (but access level checked)

## Backend API Mapping

### Permission Check
```javascript
const accessLevel = user.getAccessLevel()
if (accessLevel !== 'root' && accessLevel !== 'full') {
  return 'Permission denied - requires root or full access'
}
```

### Broadcast Scope

**Tenant-isolated:**
- Only broadcasts to users in same tenant
- Users in other tenants never see the message
- Maintains multi-tenant security model

**Target users:**
```javascript
const users = tenant.getUsers()
for (const user of users) {
  if (user.isRegistered()) {
    user.sendMessage(`:sender WALLOPS :${message}`)
  }
}
```

## Use Cases

### System Announcements
```irc
WALLOPS :Server maintenance starting in 5 minutes
→ All users in tenant see the announcement
```

### Emergency Notifications
```irc
WALLOPS :Critical: Database backup in progress, read-only mode
→ Immediate notification to all connected users
```

### Tenant-Wide Events
```irc
WALLOPS :New schema 'orders' has been deployed
WALLOPS :Reminder: Weekly sync meeting in #general
```

## User Experience

**Sender:**
```
WALLOPS :Server restarting in 10 minutes
```

**All users see:**
```
:admin!root@system WALLOPS :Server restarting in 10 minutes
```

## Examples

```irc
# System announcement
WALLOPS :Planned downtime tonight at 11 PM UTC

# Urgent notification
WALLOPS :URGENT: Security patch applied, please reconnect

# General broadcast
WALLOPS :Welcome to the new IRC interface!
```

## Comparison with Other Broadcasting

| Method | Scope | Use Case |
|--------|-------|----------|
| WALLOPS | All users in tenant | System announcements |
| PRIVMSG #channel | Users in one channel | Channel discussion |
| NOTICE #channel | Users in one channel | Bot notifications |

## Security

- Only `root`/`full` access can send
- Tenant-isolated (can't broadcast to other tenants)
- No capability requirement (access level is sufficient)
- Logged in debug mode with user count

## Implementation Details

The WALLOPS implementation:
1. Validates sender has `root` or `full` access
2. Gets all users in sender's tenant
3. Sends WALLOPS message to each registered user
4. Returns count of notified users (debug mode)

## See Also
- [PRIVMSG](PRIVMSG.md) - Send message to channel or user
- [NOTICE](NOTICE.md) - Send notice (no auto-reply)
