#!/usr/bin/env node

import { Command } from 'commander';
import { createAuthCommand } from './commands/auth.js';
import { createGmailCommand } from './commands/gmail.js';
import { createDriveCommand } from './commands/drive.js';
import { createCalendarCommand } from './commands/calendar.js';
import { createUpdateCommand } from './commands/update.js';

const program = new Command();

program
  .name('gscli')
  .description('Google Service CLI - Fast CLI tool for AI agents and developers to access Gmail, Drive, and Calendar')
  .version('0.0.4');

// Add commands
program.addCommand(createAuthCommand());
program.addCommand(createGmailCommand());
program.addCommand(createDriveCommand());
program.addCommand(createCalendarCommand());
program.addCommand(createUpdateCommand());

// Show help if no command provided
if (process.argv.length === 2) {
  program.help();
}

program.parse(process.argv);

