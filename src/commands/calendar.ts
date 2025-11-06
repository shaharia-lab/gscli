import { Command } from 'commander';
import { getAuthenticatedClient } from '../lib/auth.js';
import { listEvents, searchEvents } from '../lib/calendar.js';
import { formatCalendarEvents, showError } from '../lib/formatter.js';
import ora from 'ora';

export function createCalendarCommand(): Command {
  const calendar = new Command('calendar');
  calendar.description('Manage Google Calendar events (read-only)');

  // List command
  calendar
    .command('list')
    .description('List calendar events')
    .option('-r, --range <range>', 'Relative time range (e.g., "7d" for 7 days, "2w" for 2 weeks, "1m" for 1 month)')
    .option('-s, --start <date>', 'Start date (YYYY-MM-DD)')
    .option('-e, --end <date>', 'End date (YYYY-MM-DD)')
    .option('-l, --limit <number>', 'Maximum number of events', '50')
    .option('-a, --account <email>', 'Google account email to use (uses default if not specified)')
    .action(async (options) => {
      const spinner = ora('Fetching events...').start();
      
      try {
        const auth = await getAuthenticatedClient(options.account);
        const limit = parseInt(options.limit);

        const events = await listEvents(auth, {
          range: options.range,
          start: options.start,
          end: options.end,
          limit,
        });
        
        spinner.stop();
        formatCalendarEvents(events);
      } catch (error: any) {
        spinner.stop();
        showError(error.message);
        process.exit(1);
      }
    });

  // Search command
  calendar
    .command('search <query>')
    .description('Search calendar events by text')
    .option('-l, --limit <number>', 'Maximum number of results', '50')
    .option('-d, --days <number>', 'Number of days ahead to search', '90')
    .option('-a, --account <email>', 'Google account email to use (uses default if not specified)')
    .action(async (query: string, options) => {
      const spinner = ora('Searching events...').start();
      
      try {
        const auth = await getAuthenticatedClient(options.account);
        const limit = parseInt(options.limit);
        const daysAhead = parseInt(options.days);

        const events = await searchEvents(auth, query, {
          limit,
          daysAhead,
        });
        
        spinner.stop();
        formatCalendarEvents(events);
      } catch (error: any) {
        spinner.stop();
        showError(error.message);
        process.exit(1);
      }
    });

  return calendar;
}

