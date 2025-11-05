import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string | null;
  start: string;
  end: string;
  location?: string | null;
  organizer?: string;
  attendees?: string[];
  status: string;
  htmlLink?: string | null;
}

/**
 * Parse relative time range (e.g., "7d" means 7 days from now)
 */
function parseRelativeRange(range: string): { start: Date; end: Date } {
  const match = range.match(/^(\d+)([dDwWmM])$/);
  if (!match) {
    throw new Error('Invalid range format. Use format like "7d" for 7 days, "2w" for 2 weeks, "1m" for 1 month');
  }

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);

  switch (unit) {
    case 'd':
      end.setDate(end.getDate() + value);
      break;
    case 'w':
      end.setDate(end.getDate() + value * 7);
      break;
    case 'm':
      end.setMonth(end.getMonth() + value);
      break;
  }

  return { start, end };
}

/**
 * List calendar events
 */
export async function listEvents(
  auth: OAuth2Client,
  options: {
    range?: string;
    start?: string;
    end?: string;
    limit?: number;
  } = {}
): Promise<CalendarEvent[]> {
  const calendar = google.calendar({ version: 'v3', auth });
  const limit = options.limit || 50;

  try {
    let timeMin: Date;
    let timeMax: Date;

    if (options.range) {
      // Parse relative range
      const range = parseRelativeRange(options.range);
      timeMin = range.start;
      timeMax = range.end;
    } else if (options.start && options.end) {
      // Use explicit date range
      timeMin = new Date(options.start);
      timeMax = new Date(options.end);
    } else {
      // Default: today
      timeMin = new Date();
      timeMin.setHours(0, 0, 0, 0);
      timeMax = new Date();
      timeMax.setHours(23, 59, 59, 999);
    }

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: limit,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];

    return events.map((event) => ({
      id: event.id!,
      summary: event.summary || '(No Title)',
      description: event.description,
      start: event.start?.dateTime || event.start?.date || '',
      end: event.end?.dateTime || event.end?.date || '',
      location: event.location,
      organizer: event.organizer?.email,
      attendees: event.attendees?.map((a) => a.email!).filter(Boolean),
      status: event.status!,
      htmlLink: event.htmlLink,
    }));
  } catch (error: any) {
    throw new Error(`Failed to list events: ${error.message}`);
  }
}

/**
 * Search calendar events
 */
export async function searchEvents(
  auth: OAuth2Client,
  query: string,
  options: {
    limit?: number;
    daysAhead?: number;
  } = {}
): Promise<CalendarEvent[]> {
  const calendar = google.calendar({ version: 'v3', auth });
  const limit = options.limit || 50;
  const daysAhead = options.daysAhead || 90; // Search next 90 days by default

  try {
    const timeMin = new Date();
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + daysAhead);

    const response = await calendar.events.list({
      calendarId: 'primary',
      q: query,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: limit,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];

    return events.map((event) => ({
      id: event.id!,
      summary: event.summary || '(No Title)',
      description: event.description,
      start: event.start?.dateTime || event.start?.date || '',
      end: event.end?.dateTime || event.end?.date || '',
      location: event.location,
      organizer: event.organizer?.email,
      attendees: event.attendees?.map((a) => a.email!).filter(Boolean),
      status: event.status!,
      htmlLink: event.htmlLink,
    }));
  } catch (error: any) {
    throw new Error(`Failed to search events: ${error.message}`);
  }
}

/**
 * Get calendar list
 */
export async function getCalendars(auth: OAuth2Client): Promise<{ id: string; summary: string }[]> {
  const calendar = google.calendar({ version: 'v3', auth });

  try {
    const response = await calendar.calendarList.list();

    return (response.data.items || []).map((cal) => ({
      id: cal.id!,
      summary: cal.summary!,
    }));
  } catch (error: any) {
    throw new Error(`Failed to get calendars: ${error.message}`);
  }
}

