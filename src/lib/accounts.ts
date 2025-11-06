import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG_DIR = join(homedir(), '.config', 'gscli');
const ACCOUNTS_FILE = join(CONFIG_DIR, 'accounts.json');

export interface AccountCredentials {
  email: string;
  client_id: string;
  client_secret: string;
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

export interface AccountsConfig {
  default_account?: string;
  accounts: Record<string, AccountCredentials>;
}

/**
 * Load accounts configuration
 */
export function loadAccountsConfig(): AccountsConfig {
  if (!existsSync(ACCOUNTS_FILE)) {
    return { accounts: {} };
  }
  
  try {
    const content = readFileSync(ACCOUNTS_FILE, 'utf-8');
    return JSON.parse(content) as AccountsConfig;
  } catch (error) {
    return { accounts: {} };
  }
}

/**
 * Save accounts configuration
 */
export function saveAccountsConfig(config: AccountsConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(ACCOUNTS_FILE, JSON.stringify(config, null, 2));
}

/**
 * Add or update an account
 */
export function saveAccount(credentials: AccountCredentials): void {
  const config = loadAccountsConfig();
  config.accounts[credentials.email] = credentials;
  
  // Set as default if it's the first account
  if (!config.default_account) {
    config.default_account = credentials.email;
  }
  
  saveAccountsConfig(config);
}

/**
 * Get account credentials by email
 */
export function getAccount(email?: string): AccountCredentials | null {
  const config = loadAccountsConfig();
  
  if (email) {
    return config.accounts[email] || null;
  }
  
  // Return default account if no email specified
  if (config.default_account) {
    return config.accounts[config.default_account] || null;
  }
  
  // Return first account if no default set
  const emails = Object.keys(config.accounts);
  if (emails.length > 0) {
    return config.accounts[emails[0]];
  }
  
  return null;
}

/**
 * List all accounts
 */
export function listAccounts(): { email: string; isDefault: boolean }[] {
  const config = loadAccountsConfig();
  return Object.keys(config.accounts).map(email => ({
    email,
    isDefault: email === config.default_account,
  }));
}

/**
 * Set default account
 */
export function setDefaultAccount(email: string): void {
  const config = loadAccountsConfig();
  
  if (!config.accounts[email]) {
    throw new Error(`Account not found: ${email}`);
  }
  
  config.default_account = email;
  saveAccountsConfig(config);
}

/**
 * Remove an account
 */
export function removeAccount(email: string): void {
  const config = loadAccountsConfig();
  
  if (!config.accounts[email]) {
    throw new Error(`Account not found: ${email}`);
  }
  
  delete config.accounts[email];
  
  // Update default if we deleted it
  if (config.default_account === email) {
    const remaining = Object.keys(config.accounts);
    config.default_account = remaining.length > 0 ? remaining[0] : undefined;
  }
  
  saveAccountsConfig(config);
}

/**
 * Get user email from Google API
 */
export async function getUserEmail(accessToken: string): Promise<string> {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API responded with ${response.status}: ${errorText}`);
    }
    
    const data = await response.json() as { email: string };
    
    if (!data.email) {
      throw new Error('Email not found in user info response');
    }
    
    return data.email;
  } catch (error: any) {
    throw new Error(`Failed to fetch user email: ${error.message}`);
  }
}

