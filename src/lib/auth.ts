import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { 
  saveAccount, 
  getAccount, 
  getUserEmail, 
  AccountCredentials 
} from './accounts.js';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

const CONFIG_DIR = join(homedir(), '.config', 'gscli');
const CREDENTIALS_PATH = join(CONFIG_DIR, 'credentials.json');
const DEFAULT_CLIENT_CONFIG_PATH = join(process.cwd(), 'client.json');

interface Credentials {
  client_id?: string;
  client_secret?: string;
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

/**
 * Load client credentials
 * Priority:
 * 1. Saved in credentials.json (from previous auth login --client)
 * 2. Path specified in GOOGLE_CLIENT_CREDENTIAL_FILE environment variable
 * 3. ./client.json in current directory
 */
export function loadClientCredentials(clientPath?: string) {
  // 1. First, check if we have saved client credentials in credentials.json
  const storedCredentials = loadStoredCredentials();
  if (storedCredentials && storedCredentials.client_id && storedCredentials.client_secret) {
    return {
      client_id: storedCredentials.client_id,
      client_secret: storedCredentials.client_secret,
    };
  }

  // 2. Check provided path (from --client flag)
  if (clientPath) {
    try {
      if (existsSync(clientPath)) {
        const content = readFileSync(clientPath, 'utf-8');
        const credentials = JSON.parse(content);
        const creds = credentials.installed || credentials.web || credentials;
        
        if (!creds.client_id || !creds.client_secret) {
          throw new Error('Invalid credentials format: missing client_id or client_secret');
        }
        
        return creds;
      } else {
        throw new Error(`Client file not found: ${clientPath}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to load client credentials from ${clientPath}: ${error.message}`);
    }
  }

  // 3. Check GOOGLE_CLIENT_CREDENTIAL_FILE environment variable
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

1. During auth login (saves credentials for future use):
   gscli auth login --client /path/to/client.json

2. Environment Variable:
   export GOOGLE_CLIENT_CREDENTIAL_FILE="/path/to/your/client.json"

3. Local File:
   Create a file named "client.json" in the current directory

To get credentials:
1. Go to https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID (Desktop app)
3. Download the JSON file

Current search path: ${credentialPath}
  `);
}

/**
 * Create an OAuth2 client with the loaded credentials
 */
export function createOAuth2Client(clientPath?: string): OAuth2Client {
  const clientConfig = loadClientCredentials(clientPath);
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
export async function getAuthenticatedClient(accountEmail?: string): Promise<OAuth2Client> {
  const account = getAccount(accountEmail);

  if (!account) {
    if (accountEmail) {
      throw new Error(
        `Account not found: ${accountEmail}. Run "gscli auth list" to see available accounts.`
      );
    } else {
      throw new Error(
        'No authenticated accounts found. Please run "gscli auth login" first.'
      );
    }
  }

  const oauth2Client = new google.auth.OAuth2(
    account.client_id,
    account.client_secret,
    'http://127.0.0.1:8080'
  );

  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    scope: account.scope,
    token_type: account.token_type,
    expiry_date: account.expiry_date,
  });

  // Check if token needs refresh
  if (account.expiry_date && account.expiry_date < Date.now()) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      const updatedAccount: AccountCredentials = {
        ...account,
        access_token: credentials.access_token!,
        refresh_token: credentials.refresh_token || account.refresh_token,
        scope: credentials.scope!,
        token_type: credentials.token_type!,
        expiry_date: credentials.expiry_date!,
      };
      saveAccount(updatedAccount);
      oauth2Client.setCredentials(credentials);
    } catch (error) {
      throw new Error(
        `Failed to refresh access token for ${account.email}. Please re-authenticate with "gscli auth login".`
      );
    }
  }

  return oauth2Client;
}

/**
 * Perform OAuth2 authentication flow
 */
export async function authenticate(clientPath?: string): Promise<void> {
  const clientConfig = loadClientCredentials(clientPath);
  const oauth2Client = createOAuth2Client(clientPath);

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
    let timeoutId: NodeJS.Timeout;
    
    const server = createServer(
      async (req: IncomingMessage, res: ServerResponse) => {
        try {
          if (req.url && req.url !== '/favicon.ico') {
            const url = new URL(req.url, 'http://127.0.0.1:8080');
            const code = url.searchParams.get('code');

            if (!code) {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end('<h1>Error: No authorization code received</h1>');
              clearTimeout(timeoutId);
              server.close();
              reject(new Error('No authorization code received'));
              return;
            }

            // Exchange code for tokens
            const { tokens } = await oauth2Client.getToken(code);
            
            if (!tokens.refresh_token) {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end('<h1>Error: No refresh token received</h1>');
              clearTimeout(timeoutId);
              server.close();
              reject(new Error('No refresh token received'));
              return;
            }

            // Get user email
            const userEmail = await getUserEmail(tokens.access_token!);
            
            const accountCredentials: AccountCredentials = {
              email: userEmail,
              client_id: clientConfig.client_id,
              client_secret: clientConfig.client_secret,
              access_token: tokens.access_token!,
              refresh_token: tokens.refresh_token,
              scope: tokens.scope!,
              token_type: tokens.token_type!,
              expiry_date: tokens.expiry_date!,
            };

            // Save to multi-account system
            saveAccount(accountCredentials);
            
            console.log(`✅ Authenticated as: ${userEmail}`);
            console.log('✅ Client credentials saved. You can now delete client.json if desired.');

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

            console.log('✅ Authentication successful! Credentials saved.');
            
            // Clear timeout and close server properly
            clearTimeout(timeoutId);
            server.close(() => {
              resolve();
            });
          }
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('<h1>Error during authentication</h1>');
          clearTimeout(timeoutId);
          server.close();
          reject(error);
        }
      }
    );

    server.listen(8080, '127.0.0.1', () => {
      console.log('🌐 Local server started on http://127.0.0.1:8080');
    });

    // Handle timeout
    timeoutId = setTimeout(() => {
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
 * Remove all stored credentials (logout all accounts)
 */
export function logout(): void {
  const { ACCOUNTS_FILE } = require('./accounts.js');
  const ACCOUNTS_PATH = join(homedir(), '.config', 'gscli', 'accounts.json');
  
  if (existsSync(ACCOUNTS_PATH)) {
    unlinkSync(ACCOUNTS_PATH);
  }
  
  // Also remove old credentials.json if it exists
  if (existsSync(CREDENTIALS_PATH)) {
    unlinkSync(CREDENTIALS_PATH);
  }
}

