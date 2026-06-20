import { Command } from 'commander';
import { getAuthenticatedClient } from '../lib/auth.js';
import { listFiles, searchFiles, downloadFile, getFileMetadata, listComments, moveFile, trashFile, restoreFile, deleteFile } from '../lib/drive.js';
import { formatDriveFiles, showError, showSuccess, showInfo, formatDate, truncate } from '../lib/formatter.js';
import ora from 'ora';
import chalk from 'chalk';

export function createDriveCommand(): Command {
  const drive = new Command('drive');
  drive.description('Manage Google Drive files');

  // List command
  drive
    .command('list')
    .description('List files in your Google Drive')
    .option('-f, --folder <name-or-id>', 'Folder name or ID to list from')
    .option('-l, --limit <number>', 'Maximum number of files to list (paginated across multiple API pages)', '100')
    .option('--all', 'Fetch every matching file, paging through all results (ignores --limit)')
    .option('--include-shared', 'Include files shared with you (not just files in your Drive folders)')
    .option('--trashed', 'List files in the trash instead of active files')
    .option('-a, --account <email>', 'Google account email to use (uses default if not specified)')
    .action(async (options) => {
      const spinner = ora(options.trashed ? 'Fetching trashed files...' : 'Fetching files...').start();

      try {
        const auth = await getAuthenticatedClient(options.account);
        const limit = parseInt(options.limit);

        const files = await listFiles(auth, {
          folder: options.folder,
          limit,
          includeShared: options.includeShared,
          trashed: options.trashed,
          all: options.all,
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
    .option('-l, --limit <number>', 'Maximum number of results (paginated across multiple API pages)', '50')
    .option('--all', 'Fetch every matching file, paging through all results (ignores --limit)')
    .option('--name-only', 'Match file names only (default also searches file content)')
    .option('--include-shared', 'Include files shared with you and shared drives')
    .option('-a, --account <email>', 'Google account email to use (uses default if not specified)')
    .action(async (query: string, options) => {
      const spinner = ora('Searching files...').start();

      try {
        const auth = await getAuthenticatedClient(options.account);
        const limit = parseInt(options.limit);

        const files = await searchFiles(auth, query, limit, {
          all: options.all,
          nameOnly: options.nameOnly,
          includeShared: options.includeShared,
        });
        
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

  // Move command
  drive
    .command('move <file-id>')
    .description('Move a file to another folder')
    .requiredOption('-t, --to <name-or-id>', 'Destination folder name, ID, or "root"')
    .option('-a, --account <email>', 'Google account email to use (uses default if not specified)')
    .action(async (fileId: string, options) => {
      const spinner = ora('Moving file...').start();

      try {
        const auth = await getAuthenticatedClient(options.account);

        const file = await moveFile(auth, fileId, options.to);

        spinner.stop();
        showSuccess(`Moved "${file.name}" to: ${options.to}`);
      } catch (error: any) {
        spinner.stop();
        showError(error.message);
        process.exit(1);
      }
    });

  // Trash command
  drive
    .command('trash <file-id>')
    .description('Move a file to the trash (recoverable)')
    .option('-a, --account <email>', 'Google account email to use (uses default if not specified)')
    .action(async (fileId: string, options) => {
      const spinner = ora('Moving file to trash...').start();

      try {
        const auth = await getAuthenticatedClient(options.account);

        const file = await trashFile(auth, fileId);

        spinner.stop();
        showSuccess(`Moved "${file.name}" to trash. Restore with: gscli drive restore ${file.id}`);
      } catch (error: any) {
        spinner.stop();
        showError(error.message);
        process.exit(1);
      }
    });

  // Restore command
  drive
    .command('restore <file-id>')
    .description('Restore a file from the trash')
    .option('-a, --account <email>', 'Google account email to use (uses default if not specified)')
    .action(async (fileId: string, options) => {
      const spinner = ora('Restoring file from trash...').start();

      try {
        const auth = await getAuthenticatedClient(options.account);

        const file = await restoreFile(auth, fileId);

        spinner.stop();
        showSuccess(`Restored "${file.name}" from trash.`);
      } catch (error: any) {
        spinner.stop();
        showError(error.message);
        process.exit(1);
      }
    });

  // Delete command (permanent)
  drive
    .command('delete <file-id>')
    .description('Permanently delete a file (cannot be undone)')
    .option('-y, --yes', 'Skip confirmation prompt', false)
    .option('-a, --account <email>', 'Google account email to use (uses default if not specified)')
    .action(async (fileId: string, options) => {
      try {
        const auth = await getAuthenticatedClient(options.account);

        // Fetch metadata first so the user knows what they are deleting
        const file = await getFileMetadata(auth, fileId);

        if (!options.yes) {
          showInfo(
            `This will PERMANENTLY delete "${file.name}" (${fileId}). This cannot be undone.\n` +
            `   Re-run with --yes to confirm, or use "gscli drive trash ${fileId}" to move it to the trash instead.`
          );
          process.exit(1);
        }

        const spinner = ora('Deleting file permanently...').start();
        await deleteFile(auth, fileId);
        spinner.stop();
        showSuccess(`Permanently deleted "${file.name}".`);
      } catch (error: any) {
        showError(error.message);
        process.exit(1);
      }
    });

  return drive;
}

