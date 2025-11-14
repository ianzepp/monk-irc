# TOPIC Command

## Synopsis
```
TOPIC <#channel>
TOPIC <#channel> :<new topic>
```

## Description

View or set channel topic. Topics are stored in-memory per channel.

## Backend API Mapping

### Default Topics (Schema Channels)

**Schema channels (`#schema`):**
```
GET /api/data/{schema}
→ "Schema context: products (15 records available)"
```

**Record channels (`#schema/recordId`):**
```
GET /api/data/{schema}/{recordId}
→ "Record context: products/config-123 (record: Config Alpha)"
```

### In-Memory Topics

Topics can be set in-memory:
```javascript
channel.setTopic(newTopic, setBy)
```

**Not persisted to monk-api:**
- Topics exist only in IRC server memory
- Lost on server restart
- Channel-specific, not record-specific

In-memory topics override default schema/record info.

### Permission Check

```javascript
if (channel.hasMode('t')) {
  // Topic protection enabled (+t mode, default)
  return channel.isOperator(user)
}
// Without +t, any member can set topic
return channel.hasMember(user)
```

## Topic Precedence

1. **In-memory topic** (if set via TOPIC command)
2. **Schema/record info** (from API)
3. **No topic** (for non-schema channels)

## Examples

```irc
# View topic
TOPIC #products
← :server 332 you #products :Schema context: products (15 records available)

# Set topic
TOPIC #products :Discussing new product schema changes
← :you TOPIC #products :Discussing new product schema changes

# Clear topic
TOPIC #products :
← Topic cleared, reverts to schema info

# Record channel default topic
TOPIC #products/config-123
← :server 332 you #products/config-123 :Record context: products/config-123
```

## Topic Info

Additional topic metadata:
```javascript
{
  topic: "Custom topic text",
  setBy: "alice!alice@tenant",
  setAt: Date
}
```

Viewable via:
```
TOPIC #channel
← 332 RPL_TOPIC (topic text)
← 333 RPL_TOPICWHOTIME (who/when set)
```

## Channel Modes

**`+t` mode (default):**
- Only operators can set topic
- Regular members can view

**`-t` mode:**
- Any member can set topic

## Use Cases

### Temporary Discussion Context
```
TOPIC #products :v2.0 schema review - focusing on new fields
```

### Meeting Coordination
```
TOPIC #general :Weekly standup - 2pm UTC today
```

### Schema Context (automatic)
```
JOIN #products
→ Topic automatically shows schema info
```

## See Also
- [MODE](MODE.md) - Channel mode management (+t/-t)
- [JOIN](JOIN.md) - Default topics on join
