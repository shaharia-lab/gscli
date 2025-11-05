import { Command } from 'commander';
import { getAuthenticatedClient } from '../lib/auth.js';
import { listMessages, searchMessages, getLabels } from '../lib/gmail.js';
import { formatGmailMessages, showError } from '../lib/formatter.js';
import ora from 'ora';
import chalk from 'chalk';

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

  // Folders list command
  gmail
    .command('folders-list')
    .description('List all Gmail folders/labels')
    .action(async () => {
      const spinner = ora('Fetching folders...').start();
      
      try {
        const auth = await getAuthenticatedClient();
        const labels = await getLabels(auth);
        
        spinner.stop();
        
        if (labels.length === 0) {
          console.log(chalk.yellow('No folders/labels found.'));
          return;
        }
        
        console.log(chalk.bold.cyan(`\nFound ${labels.length} folder(s)/label(s):\n`));
        
        // Separate system labels and user labels
        const systemLabels = labels.filter(l => 
          l.id.startsWith('CATEGORY_') || 
          ['INBOX', 'SENT', 'DRAFT', 'SPAM', 'TRASH', 'UNREAD', 'STARRED', 'IMPORTANT'].includes(l.id)
        );
        const userLabels = labels.filter(l => !systemLabels.includes(l));
        
        if (systemLabels.length > 0) {
          console.log(chalk.bold('System Folders:'));
          systemLabels.forEach((label, index) => {
            console.log(chalk.gray(`  ${index + 1}. ${label.name}`));
            console.log(chalk.dim(`     ID: ${label.id}`));
          });
          console.log('');
        }
        
        if (userLabels.length > 0) {
          console.log(chalk.bold('User Labels:'));
          userLabels.forEach((label, index) => {
            console.log(chalk.green(`  ${index + 1}. ${label.name}`));
            console.log(chalk.dim(`     ID: ${label.id}`));
          });
          console.log('');
        }
      } catch (error: any) {
        spinner.stop();
        showError(error.message);
        process.exit(1);
      }
    });

  return gmail;
}

