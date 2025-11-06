# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.1.0] - 2025-11-06

### Added
- **Gmail read command** (`gscli gmail read <message-id>`) - Read full email content by ID
  - Shows subject, from, to, date, and full body
  - Supports both plain text and HTML emails
  - Extracts body from multipart messages
- **Google Drive comments command** (`gscli drive comments <file-id>`) - List comments on files
  - Shows unresolved comments by default
  - `--include-resolved` flag to show all comments
  - Displays author, content, creation date, and replies
  - Shows quoted content from document
  - Supports --account flag for multi-account usage

## [0.0.6] - 2025-11-06

### Added
- Sudo detection for self-updates
- User directory installation guide in README
- Write permission checking before update
- Helpful error messages with actionable commands

### Improved
- README installation section with recommended user directory approach
- Pre-built binaries section with detailed installation commands
- Better update experience with clear guidance

## [0.0.5] - 2025-11-06

### Added
- **Multi-account support** - Authenticate and manage multiple Google accounts
- New command: \`gscli auth list\` - List all authenticated accounts
- New command: \`gscli auth set-default <email>\` - Set default account
- New command: \`gscli auth remove <email>\` - Remove specific account
- Global \`--account <email>\` flag for all commands (gmail, drive, calendar)
- Automatic email detection during authentication
- Added \`userinfo.email\` scope for email retrieval

### Fixed
- Auth login command now exits properly after authentication (no more hanging)
- Server timeout cleanup to prevent hanging process
- Better error handling for user email fetching

### Changed
- Account storage moved to \`~/.config/gscli/accounts.json\`
- Each account stores its own client credentials and tokens
- Improved error messages for account-related issues

## [0.0.4] - 2025-11-06

### Fixed
- Self-update detection now correctly identifies compiled binaries
- Fixed false positive where compiled binary was detected as development mode

## [0.0.3] - 2025-11-06

### Added
- **Persistent client credentials storage** (`--client` flag)
  - Use `gscli auth login --client /path/to/client.json` to save client credentials
  - Client ID and secret are saved to credentials file
  - No need to keep client.json or set environment variables after first auth
  - Backward compatible with existing methods

### Changed
- Credentials loading priority: saved credentials > --client flag > env var > local file
- Improved error messages with helpful guidance for credential configuration

## [0.0.2] - 2025-11-05

### Added
- Self-update command (`gscli update`) to update the CLI to the latest version
- Update check command (`gscli update check`) to check for available updates
- Automatic binary replacement for seamless updates
- Platform-specific binary detection (Linux, macOS, Windows)
- **Enhanced Google Drive export formats:**
  - Google Docs: PDF, Markdown, Plain Text, DOCX, HTML, EPUB
  - Google Sheets: PDF, XLSX (all sheets), CSV (first sheet), TSV (first sheet), HTML
  - Google Slides: PDF, PPTX, Plain Text
  - Google Drawings: PDF, JPEG, PNG, SVG
- Warning for CSV/TSV exports that only include the first sheet
- Better error messages showing available formats for each file type
- **Gmail folders/labels listing** (`gscli gmail folders-list`)
  - View all Gmail folders and labels
  - Separates system folders (INBOX, SENT, etc.) from user labels
  - Shows label IDs for use with other commands

## [0.0.1] - 2025-11-05

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

