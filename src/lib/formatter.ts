import chalk from 'chalk';
import { GmailMessage } from './gmail.js';
import { DriveFile } from './drive.js';
import { CalendarEvent } from './calendar.js';

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes?: string): string {
  if (!bytes) return 'N/A';
  const size = parseInt(bytes);
  if (size === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(size) / Math.log(k));
  return `${(size / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format date to human-readable format
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

/**
 * Truncate text to specified length
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format Gmail messages for display
 */
export function formatGmailMessages(messages: GmailMessage[]): void {
  if (messages.length === 0) {
    console.log(chalk.yellow('No messages found.'));
    return;
  }

  console.log(chalk.bold.cyan(`\nFound ${messages.length} message(s):\n`));

  messages.forEach((msg, index) => {
    console.log(chalk.bold(`${index + 1}. ${msg.subject}`));
    console.log(chalk.gray(`   From: ${truncate(msg.from, 60)}`));
    console.log(chalk.gray(`   Date: ${formatDate(msg.date)}`));
    console.log(chalk.gray(`   Snippet: ${truncate(msg.snippet, 80)}`));
    console.log(chalk.dim(`   ID: ${msg.id}`));
    console.log('');
  });
}

/**
 * Format Drive files for display
 */
export function formatDriveFiles(files: DriveFile[]): void {
  if (files.length === 0) {
    console.log(chalk.yellow('No files found.'));
    return;
  }

  console.log(chalk.bold.cyan(`\nFound ${files.length} file(s):\n`));

  files.forEach((file, index) => {
    const icon = file.isFolder ? '📁' : '📄';
    const size = file.isFolder ? '' : ` (${formatBytes(file.size)})`;
    
    console.log(chalk.bold(`${index + 1}. ${icon} ${file.name}${size}`));
    console.log(chalk.gray(`   Type: ${file.mimeType}`));
    console.log(chalk.gray(`   Modified: ${formatDate(file.modifiedTime)}`));
    console.log(chalk.dim(`   ID: ${file.id}`));
    if (file.webViewLink) {
      console.log(chalk.dim(`   Link: ${file.webViewLink}`));
    }
    console.log('');
  });
}

/**
 * Format Calendar events for display
 */
export function formatCalendarEvents(events: CalendarEvent[]): void {
  if (events.length === 0) {
    console.log(chalk.yellow('No events found.'));
    return;
  }

  console.log(chalk.bold.cyan(`\nFound ${events.length} event(s):\n`));

  events.forEach((event, index) => {
    console.log(chalk.bold(`${index + 1}. ${event.summary}`));
    console.log(chalk.gray(`   Start: ${formatDate(event.start)}`));
    console.log(chalk.gray(`   End: ${formatDate(event.end)}`));
    
    if (event.location) {
      console.log(chalk.gray(`   Location: ${event.location}`));
    }
    
    if (event.organizer) {
      console.log(chalk.gray(`   Organizer: ${event.organizer}`));
    }
    
    if (event.attendees && event.attendees.length > 0) {
      console.log(chalk.gray(`   Attendees: ${event.attendees.slice(0, 3).join(', ')}${event.attendees.length > 3 ? '...' : ''}`));
    }
    
    if (event.description) {
      console.log(chalk.gray(`   Description: ${truncate(event.description, 100)}`));
    }
    
    console.log(chalk.dim(`   Status: ${event.status}`));
    if (event.htmlLink) {
      console.log(chalk.dim(`   Link: ${event.htmlLink}`));
    }
    console.log('');
  });
}

/**
 * Show error message
 */
export function showError(message: string): void {
  console.error(chalk.bold.red(`\n❌ Error: ${message}\n`));
}

/**
 * Show success message
 */
export function showSuccess(message: string): void {
  console.log(chalk.bold.green(`\n✅ ${message}\n`));
}

/**
 * Show info message
 */
export function showInfo(message: string): void {
  console.log(chalk.bold.blue(`\nℹ️  ${message}\n`));
}

