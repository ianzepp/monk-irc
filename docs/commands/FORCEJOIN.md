# FORCEJOIN Command

## Synopsis
```
FORCEJOIN <nickname> <channel>
```

## Description

Force a user to join a channel without their explicit consent. The user's IRC client will show them as having joined the channel.

## Requirements

1. **Capability:** Must have `force-join` capability enabled
2. **Access Level:** Must have `root` or `full` access level
3. **Target:** Target user must exist in same tenant

## Backend API Mapping

### Permission Check
```javascript
if (!user.hasCapability('force-join')) {
  return 'Permission denied - requires force-join capability'
}

if (accessLevel !== 'root' && accessLevel !== 'full') {
  return 'Permission denied - requires root or full access'
}
```

### User Experience

**Target user sees:**
```
:alice!alice@tenant JOIN #products/config-123
:irc.monk.dev 332 alice #products/config-123 :Record context: products/config-123
:irc.monk.dev 353 alice = #products/config-123 :@alice @bot
:irc.monk.dev 366 alice #products/config-123 :End of /NAMES list
```

The target never typed `/join` but their client shows the channel.

### Role Assignment

Target gets role based on their access level:
- `root`/`full` → Operator (@)
- `edit` → Voice (+)
- `read` → Regular member

## Use Cases

### Bot-Driven Channel Navigation
```irc
<user> show me the config record
<bot> FORCEJOIN user #products/config-123
→ User's client shows #products/config-123 channel
→ Bot can now discuss the record in context
```

### Automated Workflow
```
1. Bot detects user needs to review a record
2. FORCEJOIN user #schema/recordId
3. User is in channel without manual join
4. Conversation happens in channel
5. FORCEPART user #schema/recordId (when done)
```

## Comparison with INVITE

**INVITE (standard):**
```
INVITE alice #products
→ Alice receives invitation
→ Alice must manually: /join #products
```

**FORCEJOIN (monk-irc):**
```
FORCEJOIN alice #products
→ Alice is immediately in #products
→ No action required from Alice
```

## Examples

```irc
# Bot force-joins user to show them a record
FORCEJOIN alice #products/config-123
→ Alice's client shows #products/config-123

# Bot force-joins multiple users for group discussion
FORCEJOIN alice #meeting-room
FORCEJOIN bob #meeting-room
FORCEJOIN charlie #meeting-room
→ All three users now in #meeting-room
```

## Security

- Only users with `root`/`full` access can use this
- Requires explicit capability opt-in
- Tenant-isolated (can't force-join users in other tenants)
- Logged in debug mode

## See Also
- [CAP](CAP.md) - Capability negotiation
- [INVITE](INVITE.md) - Standard invitation method
- [FORCEPART](FORCEPART.md) - Polite removal
