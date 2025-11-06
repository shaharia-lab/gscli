import { Command } from 'commander';
import { getAuthenticatedClient } from '../lib/auth.js';
import { listFiles, searchFiles, downloadFile, getFileMetadata, listComments } from '../lib/drive.js';
import { formatDriveFiles, showError, showSuccess, showInfo, formatDate, truncate } from '../lib/formatter.js';
import ora from 'ora';
import chalk from 'chalk';

export function createDriveCommand(): Command {
  const drive = new Command('drive');
  drive.description('Manage Google Drive files (read-only)');

  // List command
  drive
    .command('list')
    .description('List files in your Google Drive')
    .option('-f, --folder <name-or-id>', 'Folder name or ID to list from')
    .option('-l, --limit <number>', 'Maximum number of files to list', '100')
    .option('-a, --account <email>', 'Google account email to use (uses default if not specified)')
    .action(async (options) => {
      const spinner = ora('Fetching files...').start();
      
      try {
        const auth = await getAuthenticatedClient(options.account);
        const limit = parseInt(options.limit);

        const files = await listFiles(auth, {
          folder: options.folder,
          limit,
        });
        
        spinner.stop();
        formatDriveFiles(files);
      } catch (error: any) {
        spinner.stop();
        showError(error.message);
        process.exit(1);
      }
    });

  // Search command
  drive
    .command('search <query>')
    .description('Search for files by name')
    .option('-l, --limit <number>', 'Maximum number of results', '50')
    .option('-a, --account <email>', 'Google account email to use (uses default if not specified)')
    .action(async (query: string, options) => {
      const spinner = ora('Searching files...').start();
      
      try {
        const auth = await getAuthenticatedClient(options.account);
        const limit = parseInt(options.limit);

        const files = await searchFiles(auth, query, limit);
        
        spinner.stop();
        formatDriveFiles(files);
      } catch (error: any) {
        spinner.stop();
        showError(error.message);
        process.exit(1);
      }
    });

  // Download command
  drive
    .command('download <file-id>')
    .description('Download a file by its ID')
    .option('--format <format>', 'Export format: pdf, markdown, txt, docx (Docs) | csv, tsv, xlsx (Sheets) | pptx (Slides)', 'pdf')
    .option('-o, --output <path>', 'Output directory path')
    .option('-a, --account <email>', 'Google account email to use (uses default if not specified)')
    .action(async (fileId: string, options) => {
      let spinner = ora('Fetching file metadata...').start();
      
      try {
        const auth = await getAuthenticatedClient(options.account);

        // Get file metadata first
        const metadata = await getFileMetadata(auth, fileId);
        spinner.text = `Downloading ${metadata.name}...`;

        const outputPath = await downloadFile(auth, fileId, {
          format: options.format,
          outputPath: options.output,
        });
        
        spinner.stop();
        showSuccess(`File downloaded successfully to: ${outputPath}`);
      } catch (error: any) {
        spinner.stop();
        showError(error.message);
        process.exit(1);
      }
    });

  // Comments command
  drive
    .command('comments <file-id>')
    .description('List comments on a Google Drive file')
    .option('--include-resolved', 'Include resolved comments (default: only unresolved)', false)
    .option('-a, --account <email>', 'Google account email to use (uses default if not specified)')
    .action(async (fileId: string, options) => {
      const spinner = ora('Fetching comments...').start();
      
      try {
        const auth = await getAuthenticatedClient(options.account);
        
        // Get file metadata first
        const file = await getFileMetadata(auth, fileId);
        
        const comments = await listComments(auth, fileId, {
          includeResolved: options.includeResolved,
        });
        
        spinner.stop();
        
        if (comments.length === 0) {
          console.log(chalk.yellow(`\nNo ${options.includeResolved ? '' : 'unresolved '}comments found on: ${file.name}\n`));
          return;
        }
        
        console.log(chalk.bold.cyan(`\n💬 Comments on: ${file.name}`));
        console.log(chalk.gray(`Found ${comments.length} comment(s)\n`));
        
        comments.forEach((comment, index) => {
          const resolvedBadge = comment.resolved ? chalk.green(' [RESOLVED]') : chalk.yellow(' [OPEN]');
          console.log(chalk.bold(`${index + 1}. ${comment.author}${resolvedBadge}`));
          console.log(chalk.gray(`   Created: ${formatDate(comment.createdTime)}`));
          
          if (comment.quotedContent) {
            console.log(chalk.dim(`   Quoted: "${truncate(comment.quotedContent, 60)}"`));
          }
          
          console.log(chalk.white(`   ${comment.content}`));
          
          if (comment.replies.length > 0) {
            console.log(chalk.gray(`   Replies (${comment.replies.length}):`));
            comment.replies.forEach((reply) => {
              console.log(chalk.gray(`     • ${reply.author}: ${truncate(reply.content, 80)}`));
            });
          }
          
          console.log('');
        });
      } catch (error: any) {
        spinner.stop();
        showError(error.message);
        process.exit(1);
      }
    });

  return drive;
}

