import { Command } from 'commander';
import { authenticate, isAuthenticated, logout } from '../lib/auth.js';
import { showSuccess, showError, showInfo } from '../lib/formatter.js';

export function createAuthCommand(): Command {
  const auth = new Command('auth');
  auth.description('Manage authentication with Google services');

  // Login command
  auth
    .command('login')
    .description('Authenticate with Google OAuth2')
    .action(async () => {
      try {
        if (isAuthenticated()) {
          showInfo('You are already authenticated. Use "gscli auth logout" to log out first.');
          return;
        }

        await authenticate();
        showSuccess('Successfully authenticated! You can now use gscli commands.');
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

  // Logout command
  auth
    .command('logout')
    .description('Remove stored credentials')
    .action(() => {
      try {
        logout();
        showSuccess('Successfully logged out. Your credentials have been removed.');
      } catch (error: any) {
        showError(error.message);
        process.exit(1);
      }
    });

  return auth;
}

