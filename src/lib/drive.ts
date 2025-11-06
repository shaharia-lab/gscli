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

/**
 * List files in Google Drive
 */
export async function listFiles(
  auth: OAuth2Client,
  options: {
    folder?: string;
    limit?: number;
  } = {}
): Promise<DriveFile[]> {
  const drive = google.drive({ version: 'v3', auth });
  const limit = options.limit || 100;

  try {
    let query = "trashed = false";
    
    // If folder is specified, find it first
    if (options.folder) {
      // Try to find folder by name or use as ID
      const folderQuery = `name='${options.folder}' and mimeType='application/vnd.google-apps.folder' and trashed = false`;
      const folderResponse = await drive.files.list({
        q: folderQuery,
        fields: 'files(id, name)',
        pageSize: 1,
      });

      const folder = folderResponse.data.files?.[0];
      const folderId = folder?.id || options.folder;
      query = `'${folderId}' in parents and trashed = false`;
    } else {
      // List root files only
      query = "'root' in parents and trashed = false";
    }

    const response = await drive.files.list({
      q: query,
      pageSize: limit,
      fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink)',
      orderBy: 'modifiedTime desc',
    });

    const files = response.data.files || [];
    
    return files.map((file) => ({
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType!,
      size: file.size,
      modifiedTime: file.modifiedTime!,
      webViewLink: file.webViewLink,
      isFolder: file.mimeType === 'application/vnd.google-apps.folder',
    }));
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
  limit: number = 50
): Promise<DriveFile[]> {
  const drive = google.drive({ version: 'v3', auth });

  try {
    const query = `name contains '${searchTerm}' and trashed = false`;
    
    const response = await drive.files.list({
      q: query,
      pageSize: limit,
      fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink)',
      orderBy: 'modifiedTime desc',
    });

    const files = response.data.files || [];
    
    return files.map((file) => ({
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType!,
      size: file.size,
      modifiedTime: file.modifiedTime!,
      webViewLink: file.webViewLink,
      isFolder: file.mimeType === 'application/vnd.google-apps.folder',
    }));
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

