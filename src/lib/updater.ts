import { existsSync, createWriteStream, chmodSync, unlinkSync, renameSync, readlinkSync, realpathSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const GITHUB_REPO = 'shaharia-lab/gscli';
const CURRENT_VERSION = '0.1.1';

interface GitHubRelease {
  tag_name: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
}

/**
 * Get the binary name for the current platform
 */
function getBinaryName(): string {
  const platform = process.platform;
  
  if (platform === 'linux') {
    return 'gscli-linux';
  } else if (platform === 'darwin') {
    return 'gscli-macos';
  } else if (platform === 'win32') {
    return 'gscli-windows.exe';
  }
  
  throw new Error(`Unsupported platform: ${platform}`);
}

/**
 * Get the current binary path
 */
function getCurrentBinaryPath(): string {
  // Check if running via bun run (development mode)
  const isDevMode = process.argv[0].includes('bun') && process.argv[1].includes('src/index.ts');
  
  if (isDevMode) {
    throw new Error('Self-update is not available in development mode. Please use the compiled binary.');
  }
  
  // For Linux: /proc/self/exe gives us the real binary path
  // This works even with Bun's virtual filesystem
  if (process.platform === 'linux' && existsSync('/proc/self/exe')) {
    try {
      return realpathSync('/proc/self/exe');
    } catch (e) {
      // Continue to fallback
    }
  }
  
  // For macOS: Similar approach but different path
  // TODO: Test on macOS
  
  // Fallback: Try to resolve argv paths
  try {
    if (process.argv[1] && !process.argv[1].includes('/$bunfs/')) {
      return realpathSync(process.argv[1]);
    }
  } catch {
    // Continue
  }
  
  // Last resort
  const path = process.argv[1] || process.argv[0];
  throw new Error(
    `Could not determine binary path. Detected path: ${path}\n` +
    `This might be a virtual filesystem path. Please report this issue.`
  );
}

/**
 * Fetch the latest release from GitHub
 */
async function fetchLatestRelease(): Promise<GitHubRelease> {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'gscli',
      'Accept': 'application/vnd.github.v3+json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch latest release: ${response.statusText}`);
  }
  
  return await response.json() as GitHubRelease;
}

/**
 * Compare versions (simple semver comparison)
 */
function compareVersions(current: string, latest: string): number {
  const cleanCurrent = current.replace(/^v/, '');
  const cleanLatest = latest.replace(/^v/, '');
  
  const currentParts = cleanCurrent.split('.').map(Number);
  const latestParts = cleanLatest.split('.').map(Number);
  
  for (let i = 0; i < 3; i++) {
    if (latestParts[i] > currentParts[i]) return 1;
    if (latestParts[i] < currentParts[i]) return -1;
  }
  
  return 0;
}

/**
 * Download file from URL
 */
async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }
  
  if (!response.body) {
    throw new Error('Response body is null');
  }
  
  const fileStream = createWriteStream(destPath);
  
  // @ts-ignore - Bun supports this
  for await (const chunk of response.body) {
    fileStream.write(chunk);
  }
  
  fileStream.end();
  
  return new Promise((resolve, reject) => {
    fileStream.on('finish', resolve);
    fileStream.on('error', reject);
  });
}

/**
 * Check for updates
 */
export async function checkForUpdate(): Promise<{
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
}> {
  try {
    const release = await fetchLatestRelease();
    const latestVersion = release.tag_name;
    const comparison = compareVersions(CURRENT_VERSION, latestVersion);
    
    return {
      updateAvailable: comparison > 0,
      currentVersion: CURRENT_VERSION,
      latestVersion,
    };
  } catch (error: any) {
    throw new Error(`Failed to check for updates: ${error.message}`);
  }
}

/**
 * Check if path requires sudo
 */
function requiresSudo(path: string): boolean {
  const systemPaths = ['/usr/local/bin/', '/usr/bin/', '/opt/', '/bin/', '/sbin/'];
  return systemPaths.some(p => path.startsWith(p));
}

/**
 * Check if we have write permission
 */
function canWrite(path: string): boolean {
  try {
    const { accessSync, constants } = require('fs');
    accessSync(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Perform self-update
 */
export async function performUpdate(): Promise<void> {
  try {
    // Get latest release
    const release = await fetchLatestRelease();
    const latestVersion = release.tag_name;
    
    // Check if update is needed
    const comparison = compareVersions(CURRENT_VERSION, latestVersion);
    if (comparison === 0) {
      throw new Error('Already on the latest version');
    }
    if (comparison < 0) {
      throw new Error('Current version is newer than the latest release');
    }
    
    // Get the appropriate binary for this platform
    const binaryName = getBinaryName();
    const asset = release.assets.find(a => a.name === binaryName);
    
    if (!asset) {
      throw new Error(`No binary found for platform: ${binaryName}`);
    }
    
    // Get current binary path
    const currentPath = getCurrentBinaryPath();
    
    // Check write permissions
    if (!canWrite(currentPath)) {
      const needsSudo = requiresSudo(currentPath);
      
      if (needsSudo) {
        throw new Error(
          `Cannot write to ${currentPath}. This location requires elevated privileges.\n\n` +
          `Please run with sudo:\n` +
          `  sudo gscli update\n\n` +
          `Or install in a user directory (recommended):\n` +
          `  mkdir -p ~/.local/bin\n` +
          `  cp ${currentPath} ~/.local/bin/gscli\n` +
          `  # Add to PATH: export PATH="$HOME/.local/bin:$PATH"\n` +
          `  # Then run: gscli update`
        );
      } else {
        throw new Error(
          `Cannot write to ${currentPath}. Permission denied.\n` +
          `Check file permissions or run with appropriate privileges.`
        );
      }
    }
    
    // Download to temporary location
    const tempPath = join(tmpdir(), `gscli-update-${Date.now()}`);
    console.log(`Downloading ${latestVersion}...`);
    await downloadFile(asset.browser_download_url, tempPath);
    
    // Make it executable
    chmodSync(tempPath, 0o755);
    
    // Create backup
    const backupPath = `${currentPath}.backup`;
    if (existsSync(backupPath)) {
      unlinkSync(backupPath);
    }
    renameSync(currentPath, backupPath);
    
    try {
      // Replace current binary
      renameSync(tempPath, currentPath);
      
      // Remove backup on success
      unlinkSync(backupPath);
      
      console.log(`✅ Successfully updated to ${latestVersion}`);
      console.log('Please restart the CLI to use the new version.');
    } catch (error) {
      // Restore backup on failure
      if (existsSync(backupPath)) {
        renameSync(backupPath, currentPath);
      }
      throw error;
    }
  } catch (error: any) {
    throw new Error(`Update failed: ${error.message}`);
  }
}

/**
 * Get current version
 */
export function getCurrentVersion(): string {
  return CURRENT_VERSION;
}

