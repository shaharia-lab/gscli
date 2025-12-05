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

# Install to user directory (recommended - no sudo needed)
mkdir -p ~/.local/bin
cp dist/gscli ~/.local/bin/
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Or install system-wide (requires sudo for updates)
sudo cp dist/gscli /usr/local/bin/
```

### Pre-built Binaries

Download pre-built binaries from [GitHub Releases](https://github.com/shaharia-lab/gscli/releases):

```bash
# Linux (user directory - recommended)
curl -L https://github.com/shaharia-lab/gscli/releases/latest/download/gscli-linux -o gscli
chmod +x gscli
mkdir -p ~/.local/bin
mv gscli ~/.local/bin/
export PATH="$HOME/.local/bin:$PATH"

# Or Linux (system-wide)
curl -L https://github.com/shaharia-lab/gscli/releases/latest/download/gscli-linux -o gscli
chmod +x gscli
sudo mv gscli /usr/local/bin/

# macOS
curl -L https://github.com/shaharia-lab/gscli/releases/latest/download/gscli-macos -o gscli
chmod +x gscli
mv gscli ~/.local/bin/  # or: sudo mv gscli /usr/local/bin/

# Windows
# Download gscli-windows.exe and add to PATH
```

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

### 2. Authenticate (One-Time Setup)

**Recommended: Use --client flag** (saves credentials permanently)

```bash
# Download client.json from Google Cloud Console first

# Authenticate and save client credentials
gscli auth login --client /path/to/client.json

# ✅ Client credentials are now saved!
# ✅ You can delete client.json if desired
# ✅ All future commands work without any setup!
```

**Alternative Methods:**

**Option A: Local File**
```bash
# Save as ./client.json in current directory
gscli auth login
```

**Option B: Environment Variable**
```bash
export GOOGLE_CLIENT_CREDENTIAL_FILE="/path/to/client.json"
gscli auth login
```

This opens your browser for Google OAuth2 authentication. Credentials are stored securely in `~/.config/gscli/credentials.json`.

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

#### Recommended Installation for Easy Updates

For the best update experience, install `gscli` in a user directory:

```bash
# Create user bin directory
mkdir -p ~/.local/bin

# Copy gscli there
cp /path/to/gscli ~/.local/bin/

# Add to your PATH (add to ~/.bashrc or ~/.zshrc)
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Now update without sudo
gscli update
```

**Why?**
- ✅ No sudo required for updates
- ✅ User-owned directory
- ✅ Clean and simple updates
- ✅ No system-wide changes needed

**If installed in `/usr/local/bin/` (requires sudo):**
```bash
sudo gscli update
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

# Read a specific email by ID
gscli gmail read <message-id>

# List all folders/labels
gscli gmail folders-list
```

### Google Drive Commands

```bash
# List files in root directory
gscli drive list

# List files including shared with you
gscli drive list --include-shared

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

# List comments on a file (unresolved only)
gscli drive comments <file-id>

# List all comments including resolved
gscli drive comments <file-id> --include-resolved
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

# List documents including those shared with you
gscli drive list --include-shared --limit 20

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

## Custom Build with Embedded Credentials

For advanced users who want to distribute a custom build with embedded OAuth2 credentials, you can inject your Google client credentials directly during the build process. This eliminates the need for users to provide credentials via the `--client` flag or environment variables.

### Benefits

- No need to distribute or manage `client.json` files
- Users can authenticate immediately without additional setup
- Ideal for internal tools or controlled distribution

### Build Command

```bash
# 1. Export your credentials as environment variables
export GOOGLE_CLIENT_ID="your-client-id-here.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="your-client-secret-here"

# 2. Build with embedded credentials
bun run build:custom              # Build for current platform
bun run build:custom-all          # Build for all platforms
bun run build:custom-linux        # Build for Linux only
bun run build:custom-macos        # Build for macOS only
bun run build:custom-windows      # Build for Windows only
```

The built binaries will be in the `dist/` folder with the `-custom` suffix (e.g., `dist/gscli-custom-linux`).

### Important Notes

- The credentials are embedded in the compiled binary at build time
- Users of your custom build will still need to authenticate via OAuth2 (`gscli auth login`)
- This is suitable for internal distribution or when you trust the users
- For public distribution, it's recommended to let users provide their own credentials

### Security Considerations

When building with embedded credentials:
- Only distribute to trusted users or within your organization
- Consider the OAuth consent screen settings in Google Cloud Console
- Users will authenticate with their own Google accounts, but using your OAuth2 app
- Monitor usage through Google Cloud Console

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
