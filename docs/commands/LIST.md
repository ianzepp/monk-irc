# LIST Command

## Synopsis
```
LIST
```

## Description

List all available channels, including schema channels from monk-api and active record channels.

## Backend API Mapping

### Schema Discovery

Queries monk-api for available schemas:
```
GET /api/describe/schemas
```

Each schema becomes a listable channel `#schema`.

### Channel Information

**Schema channels:**
```javascript
for (const schema of schemas) {
  channelName = `#${schema.name}`
  memberCount = channel?.getMemberCount() || 0
  topic = schema.description || `Schema: ${schema.name}`
}
```

**Record channels:**
Active record-specific channels (`#schema/recordId`) that have members.

### Response Format

```
:server 321 nick Channel :Users Name
:server 322 nick #products 3 :Product catalog schema
:server 322 nick #orders 1 :Order management
:server 322 nick #products/config-123 2 :Record-specific channel
:server 323 nick :End of /LIST
```

## Examples

```irc
LIST
← 321 nick Channel :Users Name
← 322 nick #products 5 :Product catalog schema
← 322 nick #users 2 :User management schema
← 322 nick #orders 0 :Order tracking
← 322 nick #products/config-123 2 :Record-specific channel
← 323 nick :End of /LIST
```

## Channel Categories

### Schema-level channels
- One per schema in monk-api
- Always shown in LIST (even if empty)
- Member count = current IRC users in channel

### Record-level channels
- Created when users JOIN `#schema/recordId`
- Only shown if active (has members)
- Removed when last user leaves

## Fallback Behavior

If API query fails:
```javascript
// Fall back to showing only active channels
const activeChannels = tenant.getChannelNames()
```

Shows what's currently active instead of all available schemas.

## Use Cases

### Schema Discovery
```
LIST
→ See all available schemas as channels
→ Discover what data you can access
```

### Active Discussions
```
LIST
→ See which channels have active users
→ Find ongoing conversations
```

## Tenant Isolation

LIST only shows:
- Schemas accessible to your tenant
- Channels in your tenant
- Member counts from your tenant only

## See Also
- [JOIN](JOIN.md) - Join a channel from list
- [WHOIS](WHOIS.md) - See what channels a user is in
