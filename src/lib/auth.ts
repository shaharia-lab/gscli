import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
];

const CONFIG_DIR = join(homedir(), '.config', 'gscli');
const CREDENTIALS_PATH = join(CONFIG_DIR, 'credentials.json');
const DEFAULT_CLIENT_CONFIG_PATH = join(process.cwd(), 'client.json');

interface Credentials {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

/**
 * Load client credentials from file
 * Priority:
 * 1. Path specified in GOOGLE_CLIENT_CREDENTIAL_FILE environment variable
 * 2. ./client.json in current directory
 */
export function loadClientCredentials() {
  // 1. Check GOOGLE_CLIENT_CREDENTIAL_FILE environment variable
  const envPath = process.env.GOOGLE_CLIENT_CREDENTIAL_FILE;
  const credentialPath = envPath || DEFAULT_CLIENT_CONFIG_PATH;

  try {
    if (existsSync(credentialPath)) {
      const content = readFileSync(credentialPath, 'utf-8');
      const credentials = JSON.parse(content);
      
      // Support both Google Cloud Console formats
      const creds = credentials.installed || credentials.web || credentials;
      
      if (!creds.client_id || !creds.client_secret) {
        throw new Error('Invalid credentials format: missing client_id or client_secret');
      }
      
      return creds;
    }
  } catch (error: any) {
    if (error.message.includes('Invalid credentials format')) {
      throw error;
    }
    // File doesn't exist or can't be read
  }

  // Show helpful error message
  throw new Error(`
Google OAuth2 client credentials not found!

Please provide credentials using one of these methods:

1. Environment Variable (recommended for production):
   export GOOGLE_CLIENT_CREDENTIAL_FILE="/path/to/your/client.json"

2. Local File (default):
   Create a file named "client.json" in the current directory
   Format: {"client_id": "...", "client_secret": "..."}

To get credentials:
1. Go to https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID (Desktop app)
3. Download the JSON file and save as client.json

Current search path: ${credentialPath}
  `);
}

/**
 * Create an OAuth2 client with the loaded credentials
 */
export function createOAuth2Client(): OAuth2Client {
  const clientConfig = loadClientCredentials();
  const oauth2Client = new google.auth.OAuth2(
    clientConfig.client_id,
    clientConfig.client_secret,
    'http://127.0.0.1:8080'
  );
  return oauth2Client;
}

/**
 * Load stored credentials from disk
 */
export function loadStoredCredentials(): Credentials | null {
  try {
    if (!existsSync(CREDENTIALS_PATH)) {
      return null;
    }
    const content = readFileSync(CREDENTIALS_PATH, 'utf-8');
    return JSON.parse(content) as Credentials;
  } catch (error) {
    return null;
  }
}

/**
 * Save credentials to disk
 */
function saveCredentials(credentials: Credentials): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2));
}

/**
 * Get an authenticated OAuth2 client
 */
export async function getAuthenticatedClient(): Promise<OAuth2Client> {
  const oauth2Client = createOAuth2Client();
  const storedCredentials = loadStoredCredentials();

  if (!storedCredentials) {
    throw new Error(
      'No stored credentials found. Please run "gscli auth login" first.'
    );
  }

  oauth2Client.setCredentials(storedCredentials);

  // Check if token needs refresh
  if (storedCredentials.expiry_date && storedCredentials.expiry_date < Date.now()) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      const newCredentials: Credentials = {
        access_token: credentials.access_token!,
        refresh_token: credentials.refresh_token || storedCredentials.refresh_token,
        scope: credentials.scope!,
        token_type: credentials.token_type!,
        expiry_date: credentials.expiry_date!,
      };
      saveCredentials(newCredentials);
      oauth2Client.setCredentials(newCredentials);
    } catch (error) {
      throw new Error(
        'Failed to refresh access token. Please run "gscli auth login" again.'
      );
    }
  }

  return oauth2Client;
}

/**
 * Perform OAuth2 authentication flow
 */
export async function authenticate(): Promise<void> {
  const oauth2Client = createOAuth2Client();

  // Generate authorization URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force consent screen to get refresh token
  });

  console.log('\n🔐 Starting authentication flow...\n');
  console.log('Please open this URL in your browser:\n');
  console.log(`  ${authUrl}\n`);
  console.log('Waiting for authorization...\n');

  // Create a temporary server to handle the callback
  return new Promise((resolve, reject) => {
    const server = createServer(
      async (req: IncomingMessage, res: ServerResponse) => {
        try {
          if (req.url && req.url !== '/favicon.ico') {
            const url = new URL(req.url, 'http://127.0.0.1:8080');
            const code = url.searchParams.get('code');

            if (!code) {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end('<h1>Error: No authorization code received</h1>');
              server.close();
              reject(new Error('No authorization code received'));
              return;
            }

            // Exchange code for tokens
            const { tokens } = await oauth2Client.getToken(code);
            
            if (!tokens.refresh_token) {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end('<h1>Error: No refresh token received</h1>');
              server.close();
              reject(new Error('No refresh token received'));
              return;
            }

            const credentials: Credentials = {
              access_token: tokens.access_token!,
              refresh_token: tokens.refresh_token,
              scope: tokens.scope!,
              token_type: tokens.token_type!,
              expiry_date: tokens.expiry_date!,
            };

            saveCredentials(credentials);

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <head><title>Authentication Successful</title></head>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                  <h1 style="color: #4CAF50;">✅ Authentication Successful!</h1>
                  <p>You can now close this window and return to your terminal.</p>
                </body>
              </html>
            `);

            server.close();
            console.log('✅ Authentication successful! Credentials saved.');
            resolve();
          }
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('<h1>Error during authentication</h1>');
          server.close();
          reject(error);
        }
      }
    );

    server.listen(8080, '127.0.0.1', () => {
      console.log('🌐 Local server started on http://127.0.0.1:8080');
    });

    // Handle timeout
    setTimeout(() => {
      server.close();
      reject(new Error('Authentication timeout (5 minutes)'));
    }, 5 * 60 * 1000);
  });
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return loadStoredCredentials() !== null;
}

/**
 * Remove stored credentials (logout)
 */
export function logout(): void {
  if (existsSync(CREDENTIALS_PATH)) {
    writeFileSync(CREDENTIALS_PATH, '');
  }
}

