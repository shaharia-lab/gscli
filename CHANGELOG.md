# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2025-11-05

### Initial Release

**Features:**
- ✅ OAuth2 Desktop App authentication with automatic token refresh
- ✅ Gmail read-only access (list, search)
- ✅ Google Drive read-only access (list, search, download with PDF export)
- ✅ Google Calendar read-only access (list with ranges, search)
- ✅ Standalone native binary (Linux, macOS, Windows)
- ✅ Beautiful terminal output with colors and spinners
- ✅ Simple credential management via environment variable or local file

**Project:**
- Built with TypeScript and Bun
- Designed for AI agents, automation tools, and developers
- Read-only by design for safety
- MIT License
- GitHub: https://github.com/shaharia-lab/gscli

**Commands:**
- `gscli auth login/status/logout` - Authentication management
- `gscli gmail list/search` - Email access
- `gscli drive list/search/download` - File management
- `gscli calendar list/search` - Calendar access

**Configuration:**
- Credentials: `GOOGLE_CLIENT_CREDENTIAL_FILE` env var or `./client.json`
- Tokens: Stored in `~/.config/gscli/credentials.json`

