# NICK Command

## Synopsis
```
NICK <nickname>
NICK <username>@<tenant>
NICK <nickname>!<username>@<tenant>
```

## Description

Sets the user's nickname and optionally authenticates with the monk-api backend using the extended format.

## Backend API Mapping

### Extended Format (monk-irc specific)
When using the extended format `<username>@<tenant>` or `<nickname>!<username>@<tenant>`:

1. **Authenticates with monk-api:**
   - `POST /auth/login` with `{tenant, username}`
   - Receives JWT token and access level (`root`, `full`, `edit`, `read`)
   - Stores access level on User object

2. **Creates User object:**
   - Instantiates User class with tenant association
   - Maps to tenant's user registry

3. **Access level determines channel roles:**
   - `root`/`full` → Operator (@) in all channels
   - `edit` → Voice (+) in all channels
   - `read` → Regular member (no prefix)

### Standard Format
When using just `<nickname>`:
- Must be followed by USER command for authentication
- Standard IRC behavior

## Examples

```irc
NICK root@system
→ Authenticates as 'root' in tenant 'system'
→ Access level from API determines channel permissions

NICK alice!alice@mycompany
→ Sets nickname to 'alice', authenticates as 'alice@mycompany'

NICK bob
→ Sets nickname to 'bob', requires USER command next
```

## User Object Creation

Creates a User instance with:
- Username from authentication
- Tenant association
- Access level from `/auth/login` response
- Connection binding

## See Also
- [USER](USER.md) - Alternative authentication method
- [CAP](CAP.md) - Capability negotiation
