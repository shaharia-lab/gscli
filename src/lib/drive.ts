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
    format?: 'pdf' | 'original';
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
      // Export Google Workspace files as PDF
      if (options.format === 'pdf' || !options.format) {
        outputFileName = `${fileName}.pdf`;
        const response = await drive.files.export(
          {
            fileId,
            mimeType: 'application/pdf',
          },
          { responseType: 'stream' }
        );
        responseStream = response.data;
      } else {
        throw new Error('Only PDF export is supported for Google Workspace files in MVP');
      }
    } else {
      // Download regular files
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

