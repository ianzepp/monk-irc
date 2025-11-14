# INVITE Command

## Synopsis
```
INVITE <nickname> <#channel>
```

## Description

Invite a user to join a channel. Standard (non-forcing) invitation.

## Backend API Mapping

### Permission Check

```javascript
if (!channel.canInvite(inviter)) {
  // Channel is +i (invite-only) and inviter is not operator
  return 'Permission denied'
}
```

**Default behavior:**
- Any channel member can invite (+i mode not set)
- Only operators can invite if +i mode is set

### Invitation Message

Target receives:
```
:inviter!user@host INVITE target #channel
```

Target must manually JOIN the channel.

## Comparison with FORCEJOIN

| Command | User Action Required | Use Case |
|---------|---------------------|----------|
| INVITE | Yes - must `/join` | Polite invitation, optional |
| FORCEJOIN | No - automatic | Bot workflow, immediate |

```irc
# Standard invite
INVITE alice #products
→ Alice sees: :you INVITE alice #products
→ Alice must: /join #products

# Force join (with capability)
FORCEJOIN alice #products
→ Alice is immediately in #products
```

## Invite-Notify Capability

If channel members have `invite-notify` capability:
```
:inviter!user@host INVITE target #channel
```

Broadcast to channel members (transparency).

## Examples

```irc
# Basic invite
INVITE alice #products
← 341 alice #products
→ Alice receives invitation

# Invite to record channel
INVITE bob #products/config-123
→ Bob can review specific record

# Target already in channel
INVITE alice #products
← 443 alice #products :is already on channel
```

## Use Cases

### Collaborative Review
```
JOIN #products/config-123
INVITE alice #products/config-123
INVITE bob #products/config-123
→ Group review of record
```

### Bot Invitation (polite)
```
<bot> I found the record you need
<bot> INVITE user #products/config-123
→ User chooses whether to join
```

## Workflow Comparison

**Polite flow (INVITE):**
```
1. Bot: INVITE user #channel
2. User sees invitation
3. User decides: /join #channel
```

**Immediate flow (FORCEJOIN):**
```
1. Bot: FORCEJOIN user #channel
2. User is immediately in channel
```

## See Also
- [FORCEJOIN](FORCEJOIN.md) - Force user into channel
- [MODE](MODE.md) - Channel modes (+i)
- [JOIN](JOIN.md) - Accept invitation
