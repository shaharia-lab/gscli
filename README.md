# gscli - Google Service CLI

> **A fast CLI tool for AI agents and developers to access Gmail, Drive, and Calendar from terminal**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub](https://img.shields.io/badge/github-shaharia--lab%2Fgscli-blue)](https://github.com/shaharia-lab/gscli)

## Overview

`gscli` is a powerful command-line interface designed for **AI agents**, **automation tools**, and **developers** who need programmatic access to Google services. Built with TypeScript and Bun, it provides fast, read-only access to Gmail, Google Drive, and Google Calendar directly from your terminal.

### Perfect For

- 🤖 **AI Assistants** - Give your AI agents context from emails, documents, and calendar
- 🔧 **Automation** - Script workflows that need Google data
- 💻 **Developers** - Quick CLI access without switching to browser
- 🔌 **MCP Servers** - Integrate with Model Context Protocol tools
- 📊 **Data Analysis** - Extract Google data for processing

## Features

- 📧 **Gmail** - List and search emails from your inbox
- 📁 **Google Drive** - List, search, and download files (with PDF export for Google Docs)
- 📅 **Calendar** - View and search calendar events with flexible date ranges
- ⚡ **Fast** - Built with Bun for blazing-fast performance
- 🔐 **Secure** - OAuth2 authentication with automatic token refresh
- 🎨 **Clean Output** - Beautiful, colorful terminal interface
- 🔒 **Read-Only** - Safe by design, no write operations

## Installation

### Prerequisites

- [Bun](https://bun.sh) installed (for development)
- Google Cloud Project with OAuth2 credentials

### Quick Start

```bash
# Clone the repository
git clone https://github.com/shaharia-lab/gscli.git
cd gscli

# Install dependencies
bun install

# Build the binary
bun run build

# Copy to PATH (optional)
sudo cp dist/gscli /usr/local/bin/
```

### Pre-built Binaries

Download pre-built binaries from [GitHub Releases](https://github.com/shaharia-lab/gscli/releases):

- Linux x86-64: `gscli-linux`
- macOS x86-64: `gscli-macos`
- Windows x64: `gscli-windows.exe`

## Setup

### 1. Get Google OAuth2 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable these APIs:
   - Gmail API
   - Google Drive API  
   - Google Calendar API
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Select **Desktop app** as application type
6. Download the JSON file or copy the credentials

### 2. Configure Credentials

**Option A: Local File** (Recommended for personal use)

```bash
# Save as client.json in your working directory
cat > client.json << 'EOF'
{
  "client_id": "your-client-id.apps.googleusercontent.com",
  "client_secret": "your-client-secret"
}
EOF
```

**Option B: Environment Variable** (Recommended for CI/CD)

```bash
export GOOGLE_CLIENT_CREDENTIAL_FILE="/path/to/client.json"
```

### 3. Authenticate

```bash
gscli auth login
```

This opens your browser for Google OAuth2 authentication. Tokens are stored securely in `~/.config/gscli/credentials.json`.

## Usage

### Authentication

```bash
# Login (first time)
gscli auth login

# Check authentication status
gscli auth status

# Logout
gscli auth logout
```

### Self-Update

```bash
# Update to the latest version
gscli update

# Check for available updates
gscli update check
```

### Gmail Commands

```bash
# List recent emails (default: 10)
gscli gmail list

# List with custom limit
gscli gmail list --limit 20

# List from specific folder/label
gscli gmail list --folder SENT

# Search emails with Gmail query syntax
gscli gmail search "from:boss@example.com subject:report"
gscli gmail search "is:unread after:2025/11/01"
```

### Google Drive Commands

```bash
# List files in root directory
gscli drive list

# List files in specific folder
gscli drive list --folder "Project Docs"

# Search for files by name
gscli drive search "Budget 2025"

# Download a file
gscli drive download <file-id>

# Export Google Docs to different formats
gscli drive download <doc-id> --format pdf        # PDF (default)
gscli drive download <doc-id> --format markdown   # Markdown
gscli drive download <doc-id> --format txt        # Plain text
gscli drive download <doc-id> --format docx       # Microsoft Word

# Export Google Sheets to different formats
gscli drive download <sheet-id> --format xlsx     # Excel (all sheets)
gscli drive download <sheet-id> --format csv      # CSV (first sheet only)
gscli drive download <sheet-id> --format tsv      # TSV (first sheet only)

# Export Google Slides
gscli drive download <slides-id> --format pptx    # PowerPoint

# Download to specific directory
gscli drive download <file-id> --output ./downloads
```

### Google Calendar Commands

```bash
# List today's events
gscli calendar list

# List next 7 days
gscli calendar list --range 7d

# List next 2 weeks
gscli calendar list --range 2w

# List next month
gscli calendar list --range 1m

# Custom date range
gscli calendar list --start "2025-11-10" --end "2025-11-20"

# Search events
gscli calendar search "Team Meeting"
gscli calendar search "1-on-1"
```

## Use Cases for AI Agents

### Example: Email Context for AI

```bash
# Get recent unread emails for AI to summarize
gscli gmail search "is:unread" --limit 5

# Find specific conversations
gscli gmail search "from:manager@company.com subject:project"
```

### Example: Calendar Integration

```bash
# Get today's schedule for AI planning
gscli calendar list

# Check next week's meetings
gscli calendar list --range 7d

# Find specific meetings
gscli calendar search "standup"
```

### Example: Document Access

```bash
# List recent documents
gscli drive list --limit 10

# Search for specific docs
gscli drive search "PRD"

# Download for AI processing
gscli drive download <file-id> --format pdf
```

## Architecture

```
src/
├── index.ts              # CLI entry point
├── commands/             # Command implementations
│   ├── auth.ts          # Authentication commands
│   ├── gmail.ts         # Gmail commands
│   ├── drive.ts         # Drive commands
│   └── calendar.ts      # Calendar commands
└── lib/                 # Core library modules
    ├── auth.ts          # OAuth2 authentication
    ├── gmail.ts         # Gmail API wrapper
    ├── drive.ts         # Drive API wrapper
    ├── calendar.ts      # Calendar API wrapper
    └── formatter.ts     # Output formatting
```

## Development

```bash
# Run in development mode
bun run dev <command>

# Example
bun run dev gmail list
bun run dev calendar list --range 7d

# Build for production
bun run build

# Build for all platforms
bun run build:all
```

## Security & Privacy

- **Read-Only Access** - No write/delete operations possible
- **Local Storage** - Credentials stored in `~/.config/gscli/`
- **OAuth2 Standard** - Secure Google authentication
- **Token Refresh** - Automatic token renewal
- **No Data Collection** - Your data stays on your machine

## API Scopes

The tool requests these read-only scopes:

- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/drive.readonly`
- `https://www.googleapis.com/auth/calendar.readonly`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

- 🐛 Issues: [GitHub Issues](https://github.com/shaharia-lab/gscli/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/shaharia-lab/gscli/discussions)

## Credits

Built with ❤️ by [Shaharia Lab](https://github.com/shaharia-lab)

Powered by:
- [Bun](https://bun.sh) - Fast JavaScript runtime
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Google APIs](https://github.com/googleapis/google-api-nodejs-client) - Official Google API client
- [Commander.js](https://github.com/tj/commander.js) - CLI framework
- [Chalk](https://github.com/chalk/chalk) - Terminal styling
- [Ora](https://github.com/sindresorhus/ora) - Terminal spinners

---

⭐ **Star us on GitHub:** [shaharia-lab/gscli](https://github.com/shaharia-lab/gscli)
