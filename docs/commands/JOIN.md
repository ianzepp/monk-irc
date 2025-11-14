# JOIN Command

## Synopsis
```
JOIN <#schema>
JOIN <#schema/recordId>
JOIN <#schema> [key]
```

## Description

Join a channel representing a monk-api schema or specific record. Channels are strictly validated against the backend API.

## Backend API Mapping

### Channel Format Validation

**Schema-level channels:** `#schema`
- Maps to monk-api schema
- Example: `#products` → schema "products"

**Record-level channels:** `#schema/recordId`
- Maps to specific record in schema
- Example: `#products/config-123` → record "config-123" in "products" schema

### API Validation

**For schema channels (`#schema`):**
```
GET /api/data/{schema}
→ Must return 200 OK
→ 404 = "Schema not found" - JOIN rejected
→ 403 = "Access denied" - JOIN rejected
```

**For record channels (`#schema/recordId`):**
```
GET /api/data/{schema}/{recordId}
→ Must return 200 OK
→ 404 = "Record not found" - JOIN rejected
→ 403 = "Access denied" - JOIN rejected
```

### Role Assignment

User's channel role is determined by their global access level (from login):

```javascript
if (accessLevel === 'root' || accessLevel === 'full') {
  role = OPERATOR (@)
} else if (accessLevel === 'edit') {
  role = VOICE (+)
} else {
  role = MEMBER (no prefix)
}
```

**Exception:** First user in channel always gets OPERATOR (channel creator)

## Channel Lifecycle

1. **Validation:** API query confirms schema/record exists
2. **Creation:** Channel created in tenant's channel registry
3. **Membership:** User added with role based on access level
4. **Topic:** Schema info shown as default topic
5. **Cleanup:** Empty channels removed when last user leaves

## Examples

```irc
JOIN #products
→ GET /api/data/products
→ Topic: "Schema context: products (15 records available)"

JOIN #products/config-123
→ GET /api/data/products/config-123
→ Topic: "Record context: products/config-123 (record: Config Alpha)"

JOIN #nonexistent
→ GET /api/data/nonexistent → 404
→ ERROR: Schema 'nonexistent' not found
```

## Access Control

- User must have read access to schema/record
- Access validated via API response (200 OK = allowed)
- Channels cannot be joined if API denies access

## See Also
- [PART](PART.md) - Leave a channel
- [TOPIC](TOPIC.md) - View/set channel topic
- [NAMES](NAMES.md) - List channel members
