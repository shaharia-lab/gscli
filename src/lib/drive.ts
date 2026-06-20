import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { createWriteStream } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string | null;
  modifiedTime: string;
  webViewLink?: string | null;
  isFolder: boolean;
}

const GOOGLE_DOCS_MIME_TYPES = [
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
  'application/vnd.google-apps.drawing',
];

// Export format mappings
const EXPORT_FORMATS: Record<string, Record<string, { mimeType: string; extension: string }>> = {
  'application/vnd.google-apps.document': {
    pdf: { mimeType: 'application/pdf', extension: '.pdf' },
    docx: { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extension: '.docx' },
    markdown: { mimeType: 'text/markdown', extension: '.md' },
    txt: { mimeType: 'text/plain', extension: '.txt' },
    html: { mimeType: 'application/zip', extension: '.zip' },
    epub: { mimeType: 'application/epub+zip', extension: '.epub' },
  },
  'application/vnd.google-apps.spreadsheet': {
    pdf: { mimeType: 'application/pdf', extension: '.pdf' },
    xlsx: { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: '.xlsx' },
    csv: { mimeType: 'text/csv', extension: '.csv' },
    tsv: { mimeType: 'text/tab-separated-values', extension: '.tsv' },
    html: { mimeType: 'application/zip', extension: '.zip' },
  },
  'application/vnd.google-apps.presentation': {
    pdf: { mimeType: 'application/pdf', extension: '.pdf' },
    pptx: { mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', extension: '.pptx' },
    txt: { mimeType: 'text/plain', extension: '.txt' },
  },
  'application/vnd.google-apps.drawing': {
    pdf: { mimeType: 'application/pdf', extension: '.pdf' },
    jpeg: { mimeType: 'image/jpeg', extension: '.jpg' },
    png: { mimeType: 'image/png', extension: '.png' },
    svg: { mimeType: 'image/svg+xml', extension: '.svg' },
  },
};

// The Drive API caps a single page at 1000 results.
const MAX_PAGE_SIZE = 1000;

/**
 * Escape a user-provided value for safe interpolation into a Drive query
 * string literal. Backslashes must be escaped before quotes.
 */
function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Map a raw Drive API file resource to our DriveFile shape.
 */
function mapDriveFile(file: any): DriveFile {
  return {
    id: file.id!,
    name: file.name!,
    mimeType: file.mimeType!,
    size: file.size,
    modifiedTime: file.modifiedTime!,
    webViewLink: file.webViewLink,
    isFolder: file.mimeType === 'application/vnd.google-apps.folder',
  };
}

/**
 * Run a files.list query, following nextPageToken across pages.
 * Stops once `limit` files are collected, or fetches every page when `all` is set.
 */
async function listAllPages(
  drive: ReturnType<typeof google.drive>,
  params: Record<string, any>,
  options: { limit?: number; all?: boolean }
): Promise<DriveFile[]> {
  const fetchAll = options.all === true;
  const target = fetchAll ? Infinity : (options.limit ?? 100);
  const collected: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const remaining = target - collected.length;
    if (!fetchAll && remaining <= 0) break;

    const response = await drive.files.list({
      ...params,
      pageSize: fetchAll ? MAX_PAGE_SIZE : Math.min(MAX_PAGE_SIZE, remaining),
      pageToken,
    });

    for (const file of response.data.files || []) {
      collected.push(mapDriveFile(file));
    }
    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken && (fetchAll || collected.length < target));

  return fetchAll ? collected : collected.slice(0, target);
}

/**
 * List files in Google Drive
 */
export async function listFiles(
  auth: OAuth2Client,
  options: {
    folder?: string;
    limit?: number;
    includeShared?: boolean;
    trashed?: boolean;
    all?: boolean;
  } = {}
): Promise<DriveFile[]> {
  const drive = google.drive({ version: 'v3', auth });
  const trashedClause = `trashed = ${options.trashed ? 'true' : 'false'}`;

  try {
    let query = trashedClause;

    // If folder is specified, find it first
    if (options.folder) {
      const folderId = await resolveFolderId(auth, options.folder);
      query = `'${folderId}' in parents and ${trashedClause}`;
    } else if (options.trashed || options.includeShared) {
      // List all files (trashed view spans the whole drive, not just root)
      query = trashedClause;
    } else {
      // List root files only
      query = `'root' in parents and ${trashedClause}`;
    }

    return await listAllPages(
      drive,
      {
        q: query,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)',
        orderBy: 'modifiedTime desc',
        ...(options.includeShared && { corpora: 'allDrives', includeItemsFromAllDrives: true, supportsAllDrives: true }),
      },
      { limit: options.limit ?? 100, all: options.all }
    );
  } catch (error: any) {
    throw new Error(`Failed to list files: ${error.message}`);
  }
}

/**
 * Search files in Google Drive
 */
export async function searchFiles(
  auth: OAuth2Client,
  searchTerm: string,
  limit: number = 50,
  options: { all?: boolean; nameOnly?: boolean; includeShared?: boolean } = {}
): Promise<DriveFile[]> {
  const drive = google.drive({ version: 'v3', auth });

  try {
    // Escape so the term can't break the query.
    const escaped = escapeDriveQueryValue(searchTerm);

    // By default match both the file name and its full-text content (what the
    // Drive web UI does). Use nameOnly for a narrower, name-only match.
    const matchClause = options.nameOnly
      ? `name contains '${escaped}'`
      : `(name contains '${escaped}' or fullText contains '${escaped}')`;

    const query = `${matchClause} and trashed = false`;

    return await listAllPages(
      drive,
      {
        q: query,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)',
        orderBy: 'modifiedTime desc',
        ...(options.includeShared && { corpora: 'allDrives', includeItemsFromAllDrives: true, supportsAllDrives: true }),
      },
      { limit, all: options.all }
    );
  } catch (error: any) {
    throw new Error(`Failed to search files: ${error.message}`);
  }
}

/**
 * Download a file from Google Drive
 */
export async function downloadFile(
  auth: OAuth2Client,
  fileId: string,
  options: {
    format?: string;
    outputPath?: string;
  } = {}
): Promise<string> {
  const drive = google.drive({ version: 'v3', auth });

  try {
    // Get file metadata first
    const metadata = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType',
    });

    const file = metadata.data;
    const mimeType = file.mimeType!;
    const fileName = file.name!;

    // Determine if this is a Google Workspace file
    const isGoogleDoc = GOOGLE_DOCS_MIME_TYPES.includes(mimeType);
    
    let outputFileName: string;
    let responseStream: any;

    if (isGoogleDoc) {
      // Export Google Workspace files
      const requestedFormat = options.format || 'pdf';
      const formatConfig = EXPORT_FORMATS[mimeType]?.[requestedFormat];
      
      if (!formatConfig) {
        const availableFormats = Object.keys(EXPORT_FORMATS[mimeType] || {}).join(', ');
        throw new Error(
          `Unsupported export format '${requestedFormat}' for this file type.\n` +
          `Available formats: ${availableFormats || 'none'}`
        );
      }
      
      // Special handling for sheets with CSV/TSV (first sheet only)
      if (mimeType === 'application/vnd.google-apps.spreadsheet' && 
          (requestedFormat === 'csv' || requestedFormat === 'tsv')) {
        console.warn(`Note: ${requestedFormat.toUpperCase()} export only includes the first sheet. Use 'xlsx' format for all sheets.`);
      }
      
      outputFileName = `${fileName}${formatConfig.extension}`;
      const response = await drive.files.export(
        {
          fileId,
          mimeType: formatConfig.mimeType,
        },
        { responseType: 'stream' }
      );
      responseStream = response.data;
    } else {
      // Download regular files (images, videos, etc.)
      if (options.format && options.format !== 'original') {
        throw new Error('Format conversion is only supported for Google Workspace files (Docs, Sheets, Slides)');
      }
      
      outputFileName = fileName;
      const response = await drive.files.get(
        {
          fileId,
          alt: 'media',
        },
        { responseType: 'stream' }
      );
      responseStream = response.data;
    }

    // Determine output path
    const outputPath = options.outputPath 
      ? join(options.outputPath, outputFileName)
      : join(process.cwd(), outputFileName);

    // Save file
    const dest = createWriteStream(outputPath);
    await pipeline(responseStream, dest);

    return outputPath;
  } catch (error: any) {
    throw new Error(`Failed to download file: ${error.message}`);
  }
}

/**
 * Resolve a folder name or ID to a folder ID.
 * Accepts the special value "root" for the Drive root, an exact folder ID,
 * or a folder name (the first matching folder is used).
 */
export async function resolveFolderId(
  auth: OAuth2Client,
  nameOrId: string
): Promise<string> {
  if (nameOrId === 'root') {
    return 'root';
  }

  const drive = google.drive({ version: 'v3', auth });

  // Try to find a folder with this name first
  const folderQuery = `name='${escapeDriveQueryValue(nameOrId)}' and mimeType='application/vnd.google-apps.folder' and trashed = false`;
  const folderResponse = await drive.files.list({
    q: folderQuery,
    fields: 'files(id, name)',
    pageSize: 1,
  });

  const folder = folderResponse.data.files?.[0];
  if (folder?.id) {
    return folder.id;
  }

  // Otherwise assume the value is already a folder ID
  return nameOrId;
}

/**
 * Move a file to a different folder.
 * The destination can be a folder name, a folder ID, or "root".
 */
export async function moveFile(
  auth: OAuth2Client,
  fileId: string,
  destination: string
): Promise<DriveFile> {
  const drive = google.drive({ version: 'v3', auth });

  try {
    const targetFolderId = await resolveFolderId(auth, destination);

    // Get the current parents so we can remove them
    const current = await drive.files.get({
      fileId,
      fields: 'id, name, parents',
    });

    const previousParents = (current.data.parents || []).join(',');

    const response = await drive.files.update({
      fileId,
      addParents: targetFolderId,
      removeParents: previousParents || undefined,
      fields: 'id, name, mimeType, size, modifiedTime, webViewLink',
    });

    const file = response.data;

    return {
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType!,
      size: file.size,
      modifiedTime: file.modifiedTime!,
      webViewLink: file.webViewLink,
      isFolder: file.mimeType === 'application/vnd.google-apps.folder',
    };
  } catch (error: any) {
    throw new Error(`Failed to move file: ${error.message}`);
  }
}

/**
 * Move a file to the trash (recoverable).
 */
export async function trashFile(
  auth: OAuth2Client,
  fileId: string
): Promise<DriveFile> {
  const drive = google.drive({ version: 'v3', auth });

  try {
    const response = await drive.files.update({
      fileId,
      requestBody: { trashed: true },
      fields: 'id, name, mimeType, size, modifiedTime, webViewLink',
    });

    const file = response.data;

    return {
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType!,
      size: file.size,
      modifiedTime: file.modifiedTime!,
      webViewLink: file.webViewLink,
      isFolder: file.mimeType === 'application/vnd.google-apps.folder',
    };
  } catch (error: any) {
    throw new Error(`Failed to trash file: ${error.message}`);
  }
}

/**
 * Restore a file from the trash.
 */
export async function restoreFile(
  auth: OAuth2Client,
  fileId: string
): Promise<DriveFile> {
  const drive = google.drive({ version: 'v3', auth });

  try {
    const response = await drive.files.update({
      fileId,
      requestBody: { trashed: false },
      fields: 'id, name, mimeType, size, modifiedTime, webViewLink',
    });

    const file = response.data;

    return {
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType!,
      size: file.size,
      modifiedTime: file.modifiedTime!,
      webViewLink: file.webViewLink,
      isFolder: file.mimeType === 'application/vnd.google-apps.folder',
    };
  } catch (error: any) {
    throw new Error(`Failed to restore file: ${error.message}`);
  }
}

/**
 * Permanently delete a file. This cannot be undone.
 */
export async function deleteFile(
  auth: OAuth2Client,
  fileId: string
): Promise<void> {
  const drive = google.drive({ version: 'v3', auth });

  try {
    await drive.files.delete({ fileId });
  } catch (error: any) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Get available export formats for a file
 */
export function getAvailableFormats(mimeType: string): string[] {
  if (EXPORT_FORMATS[mimeType]) {
    return Object.keys(EXPORT_FORMATS[mimeType]);
  }
  return ['original'];
}

/**
 * Get file metadata
 */
export async function getFileMetadata(
  auth: OAuth2Client,
  fileId: string
): Promise<DriveFile> {
  const drive = google.drive({ version: 'v3', auth });

  try {
    const response = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, modifiedTime, webViewLink',
    });

    const file = response.data;
    
    return {
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType!,
      size: file.size,
      modifiedTime: file.modifiedTime!,
      webViewLink: file.webViewLink,
      isFolder: file.mimeType === 'application/vnd.google-apps.folder',
    };
  } catch (error: any) {
    throw new Error(`Failed to get file metadata: ${error.message}`);
  }
}

export interface DriveComment {
  id: string;
  content: string;
  author: string;
  authorEmail?: string | null;
  createdTime: string;
  modifiedTime: string;
  resolved: boolean;
  quotedContent?: string;
  replies: Array<{
    id: string;
    content: string;
    author: string;
    createdTime: string;
  }>;
}

/**
 * List comments on a file
 */
export async function listComments(
  auth: OAuth2Client,
  fileId: string,
  options: {
    includeResolved?: boolean;
  } = {}
): Promise<DriveComment[]> {
  const drive = google.drive({ version: 'v3', auth });

  try {
    const response = await drive.comments.list({
      fileId,
      fields: 'comments(id, content, author, createdTime, modifiedTime, resolved, quotedFileContent, replies(id, content, author, createdTime))',
      includeDeleted: false,
    });

    const comments = response.data.comments || [];
    
    // Filter out resolved comments if not requested
    const filteredComments = options.includeResolved 
      ? comments 
      : comments.filter(c => !c.resolved);

    return filteredComments.map((comment) => ({
      id: comment.id!,
      content: comment.content!,
      author: comment.author?.displayName || 'Unknown',
      authorEmail: comment.author?.emailAddress,
      createdTime: comment.createdTime!,
      modifiedTime: comment.modifiedTime!,
      resolved: comment.resolved || false,
      quotedContent: comment.quotedFileContent?.value,
      replies: (comment.replies || []).map((reply) => ({
        id: reply.id!,
        content: reply.content!,
        author: reply.author?.displayName || 'Unknown',
        createdTime: reply.createdTime!,
      })),
    }));
  } catch (error: any) {
    throw new Error(`Failed to list comments: ${error.message}`);
  }
}

