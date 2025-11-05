# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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

