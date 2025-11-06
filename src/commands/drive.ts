import { Command } from 'commander';
import { getAuthenticatedClient } from '../lib/auth.js';
import { listFiles, searchFiles, downloadFile, getFileMetadata } from '../lib/drive.js';
import { formatDriveFiles, showError, showSuccess, showInfo } from '../lib/formatter.js';
import ora from 'ora';

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

  return drive;
}

