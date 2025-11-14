# FORCEPART Command

## Synopsis
```
FORCEPART <channel> <nickname> [:<reason>]
```

## Description

Force a user to part (leave) a channel. This is a "polite kick" - the user sees a PART message instead of being KICKed.

## Requirements

1. **Capability:** Must have `force-part` capability enabled
2. **Access Level:** Must have `root` or `full` access level
3. **Target:** Target user must be in the specified channel

## Backend API Mapping

### Permission Check
```javascript
if (!user.hasCapability('force-part')) {
  return 'Permission denied - requires force-part capability'
}

if (accessLevel !== 'root' && accessLevel !== 'full') {
  return 'Permission denied - requires root or full access'
}
```

### User Experience

**What everyone sees (including target):**
```
:alice!alice@tenant PART #products :Conversation complete
```

**Compared to KICK:**
```
:bot!bot@tenant KICK #products alice :Removed from channel
```

FORCEPART appears as a voluntary leave, KICK appears as a forced removal.

## Use Cases

### Bot-Driven Cleanup
```irc
<bot> Here's the information you requested
<bot> FORCEPART #products/config-123 alice :Info delivered
→ Alice gracefully exits the channel
```

### Workflow Completion
```
1. Bot force-joins user to #schema/recordId
2. User reviews/edits record
3. Bot detects completion
4. FORCEPART #schema/recordId user :Task complete
```

### Polite Removal
When you want to remove someone without the harshness of a KICK:
```
FORCEPART #products alice :Moving you to #products/new-config
FORCEJOIN alice #products/new-config
→ Smooth channel transition
```

## Comparison Table

| Command | Appearance | Perception | Use Case |
|---------|-----------|------------|----------|
| FORCEPART | `:user PART #channel :reason` | Voluntary leave | Polite removal, workflow completion |
| KICK | `:kicker KICK #channel user :reason` | Forced removal | Rule violation, moderation |
| PART | `:user PART #channel` | User action | User chooses to leave |

## Examples

```irc
# Simple force-part
FORCEPART #products alice
→ :alice!alice@tenant PART #products :Requested to leave

# With custom reason
FORCEPART #products alice :Your session has ended
→ :alice!alice@tenant PART #products :Your session has ended

# Bot workflow
FORCEPART #temp-channel alice :Discussion complete, see #archive
→ Polite removal with helpful message
```

## Channel Cleanup

After FORCEPART:
1. User removed from channel
2. User's User object updated (channel removed)
3. If channel is now empty, it's deleted from tenant registry

## Security

- Only users with `root`/`full` access can use this
- Requires explicit capability opt-in
- Tenant-isolated (can't force-part users in other tenants)
- Logged in debug mode

## See Also
- [CAP](CAP.md) - Capability negotiation
- [FORCEJOIN](FORCEJOIN.md) - Force user into channel
- [KICK](KICK.md) - Standard forced removal
- [PART](PART.md) - Voluntary leave
