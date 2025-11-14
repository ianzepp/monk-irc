# USER Command

## Synopsis
```
USER <username@tenant> <mode> <unused> :<realname>
```

## Description

Set username and realname, authenticate with monk-api backend. Alternative to NICK command for authentication.

## Backend API Mapping

### Authentication Flow

```
POST /auth/login
{
  "tenant": "system",
  "username": "alice"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "jwt_token_here",
    "access": "root"
  }
}
```

### User Object Creation

Creates User instance with:
- `username` - from USER command
- `tenant` - from USER command
- `realname` - from USER command
- `nickname` - from previous NICK command or defaults to username
- `accessLevel` - from API response

### Registration Completion

Registration completes when:
1. NICK command sets nickname
2. USER command authenticates with API
3. JWT token received

Both commands can authenticate - USER provides alternative to NICK's extended format.

## Format Differences

### NICK-based (recommended)
```
NICK alice@system
USER * 0 * :Alice Smith
→ NICK authenticates, USER just sets realname
```

### USER-based (alternative)
```
NICK alice
USER alice@system 0 * :Alice Smith
→ USER authenticates, NICK just sets nickname
```

## Access Level Mapping

Access level from `/auth/login` determines channel roles:

```javascript
{
  "root": OPERATOR (@),
  "full": OPERATOR (@),
  "edit": VOICE (+),
  "read": MEMBER (no prefix)
}
```

## Examples

```irc
# Standard flow
NICK alice
USER alice@mycompany 0 * :Alice from Marketing
→ Authenticates as alice@mycompany
→ Realname: "Alice from Marketing"

# If already authenticated via NICK
NICK alice@mycompany
USER * 0 * :Alice Smith
→ Just updates realname
```

## Parameters

- `<username@tenant>` - Authentication identifier
- `<mode>` - User mode (usually 0, ignored)
- `<unused>` - Unused parameter (usually *, standard IRC)
- `<realname>` - Human-readable name

## See Also
- [NICK](NICK.md) - Set nickname and authenticate
- [CAP](CAP.md) - Capability negotiation
