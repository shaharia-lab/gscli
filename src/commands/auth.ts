import { Command } from 'commander';
import { authenticate, isAuthenticated, logout } from '../lib/auth.js';
import { listAccounts, setDefaultAccount, removeAccount } from '../lib/accounts.js';
import { showSuccess, showError, showInfo } from '../lib/formatter.js';
import chalk from 'chalk';

export function createAuthCommand(): Command {
  const auth = new Command('auth');
  auth.description('Manage authentication with Google services');

  // Login command
  auth
    .command('login')
    .description('Authenticate with Google OAuth2')
    .option('--client <path>', 'Path to client credentials JSON file (saves for future use)')
    .action(async (options) => {
      try {
        if (isAuthenticated()) {
          showInfo('You are already authenticated. Use "gscli auth logout" to log out first.');
          return;
        }

        await authenticate(options.client);
        showSuccess('Successfully authenticated! You can now use gscli commands.');
        
        if (options.client) {
          console.log('💡 Client credentials saved to credentials file.');
          console.log('   You can now delete the client.json file if desired.');
        }
      } catch (error: any) {
        showError(error.message);
        process.exit(1);
      }
    });

  // Status command
  auth
    .command('status')
    .description('Check authentication status')
    .action(() => {
      if (isAuthenticated()) {
        showSuccess('You are authenticated and ready to use gscli.');
      } else {
        showInfo('You are not authenticated. Run "gscli auth login" to get started.');
      }
    });

  // List accounts command
  auth
    .command('list')
    .description('List all authenticated accounts')
    .action(() => {
      try {
        const accounts = listAccounts();
        
        if (accounts.length === 0) {
          showInfo('No authenticated accounts. Run "gscli auth login" to get started.');
          return;
        }
        
        console.log(chalk.bold.cyan(`\nAuthenticated accounts (${accounts.length}):\n`));
        
        accounts.forEach((account, index) => {
          const defaultMarker = account.isDefault ? chalk.green(' (default)') : '';
          console.log(chalk.bold(`${index + 1}. ${account.email}${defaultMarker}`));
        });
        console.log('');
      } catch (error: any) {
        showError(error.message);
        process.exit(1);
      }
    });

  // Set default account command
  auth
    .command('set-default <email>')
    .description('Set the default account to use')
    .action((email: string) => {
      try {
        setDefaultAccount(email);
        showSuccess(`Default account set to: ${email}`);
      } catch (error: any) {
        showError(error.message);
        process.exit(1);
      }
    });

  // Remove account command
  auth
    .command('remove <email>')
    .description('Remove an authenticated account')
    .action((email: string) => {
      try {
        removeAccount(email);
        showSuccess(`Account removed: ${email}`);
      } catch (error: any) {
        showError(error.message);
        process.exit(1);
      }
    });

  // Logout command (remove all)
  auth
    .command('logout')
    .description('Remove all stored credentials')
    .action(() => {
      try {
        logout();
        showSuccess('Successfully logged out. All credentials have been removed.');
      } catch (error: any) {
        showError(error.message);
        process.exit(1);
      }
    });

  return auth;
}

