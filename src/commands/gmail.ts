import { Command } from 'commander';
import { getAuthenticatedClient } from '../lib/auth.js';
import { listMessages, searchMessages } from '../lib/gmail.js';
import { formatGmailMessages, showError } from '../lib/formatter.js';
import ora from 'ora';

export function createGmailCommand(): Command {
  const gmail = new Command('gmail');
  gmail.description('Manage Gmail messages (read-only)');

  // List command
  gmail
    .command('list')
    .description('List recent emails from your inbox')
    .option('-l, --limit <number>', 'Maximum number of messages to list', '10')
    .option('-f, --folder <label>', 'Folder/label to list from (e.g., "INBOX", "SENT", "DRAFT")', 'INBOX')
    .action(async (options) => {
      const spinner = ora('Fetching messages...').start();
      
      try {
        const auth = await getAuthenticatedClient();
        const limit = parseInt(options.limit);
        const label = options.folder.toUpperCase();

        const messages = await listMessages(auth, { limit, label });
        
        spinner.stop();
        formatGmailMessages(messages);
      } catch (error: any) {
        spinner.stop();
        showError(error.message);
        process.exit(1);
      }
    });

  // Search command
  gmail
    .command('search <query>')
    .description('Search emails using Gmail query syntax')
    .option('-l, --limit <number>', 'Maximum number of results', '10')
    .action(async (query: string, options) => {
      const spinner = ora('Searching messages...').start();
      
      try {
        const auth = await getAuthenticatedClient();
        const limit = parseInt(options.limit);

        const messages = await searchMessages(auth, query, limit);
        
        spinner.stop();
        formatGmailMessages(messages);
      } catch (error: any) {
        spinner.stop();
        showError(error.message);
        process.exit(1);
      }
    });

  return gmail;
}

