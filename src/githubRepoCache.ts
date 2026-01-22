import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as https from 'https';
import * as tar from 'tar';
import { LibraryConfig } from './types';
import { logInfo } from './log';
import { getGitHubToken } from './githubAuth';

interface RepoCacheMeta {
  createdAt: string;
  extractedRootFolder: string;
}

function sanitizeForPath(s: string): string {
  return s.replace(/[^a-zA-Z0-9_.-]+/g, '_');
}

function ensureDirSync(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function rmRf(dir: string): Promise<void> {
  await fs.promises.rm(dir, { recursive: true, force: true });
}

/**
 * Download a file with optional authentication and retry logic.
 */
async function downloadToFile(
  url: string,
  destPath: string,
  token?: string,
  retryCount: number = 3
): Promise<void> {
  const headers: Record<string, string> = {
    'User-Agent': 'vscode-skills-importer'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const attempt = async (attemptsLeft: number): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      const request = https.get(url, { headers }, (res) => {
        const status = res.statusCode ?? 0;

        // Handle redirects
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          void downloadToFile(res.headers.location, destPath, token, attemptsLeft)
            .then(resolve, reject);
          return;
        }

        // Handle auth errors specifically
        if (status === 401 || status === 403) {
          res.resume();
          const authError = new Error(
            `Authentication required or access denied (${status}). ` +
            'For private repositories, please sign in to GitHub via the extension.'
          );
          (authError as NodeJS.ErrnoException).code = 'AUTH_REQUIRED';
          reject(authError);
          return;
        }

        // Handle not found
        if (status === 404) {
          res.resume();
          reject(new Error(
            `Repository or ref not found (404). Please check the repository name and branch/tag.`
          ));
          return;
        }

        if (status < 200 || status >= 300) {
          res.resume();
          const err = new Error(`Download failed (${status}) for ${url}`);
          if (attemptsLeft > 1) {
            logInfo(`Download failed with status ${status}, retrying... (${attemptsLeft - 1} attempts left)`);
            setTimeout(() => {
              void attempt(attemptsLeft - 1).then(resolve, reject);
            }, 1000 * (retryCount - attemptsLeft + 1)); // Exponential backoff
          } else {
            reject(err);
          }
          return;
        }

        const file = fs.createWriteStream(destPath);
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
        file.on('error', (err) => {
          reject(err);
        });
      });

      request.on('error', (err) => {
        if (attemptsLeft > 1) {
          logInfo(`Network error, retrying... (${attemptsLeft - 1} attempts left)`);
          setTimeout(() => {
            void attempt(attemptsLeft - 1).then(resolve, reject);
          }, 1000 * (retryCount - attemptsLeft + 1));
        } else {
          reject(err);
        }
      });
    });
  };

  await attempt(retryCount);
}

/**
 * Get the cache directory path for the extension.
 */
export function getCacheDir(context: vscode.ExtensionContext): string {
  const storage = context.globalStorageUri.fsPath || path.join(os.tmpdir(), 'vscode-skills-importer');
  return path.join(storage, 'repo-cache');
}

/**
 * Clear all cached repositories.
 */
export async function clearCache(context: vscode.ExtensionContext): Promise<void> {
  const cacheRoot = getCacheDir(context);
  if (fs.existsSync(cacheRoot)) {
    await rmRf(cacheRoot);
    logInfo('Cache cleared');
  }
}

/**
 * Clear the cache for a specific library configuration.
 */
export async function clearCacheForLibrary(
  context: vscode.ExtensionContext,
  cfg: LibraryConfig
): Promise<void> {
  const cacheRoot = getCacheDir(context);
  const cacheKey = sanitizeForPath(`${cfg.owner}__${cfg.repo}__${cfg.ref}`);
  const cacheDir = path.join(cacheRoot, cacheKey);

  if (fs.existsSync(cacheDir)) {
    await rmRf(cacheDir);
    logInfo(`Cache cleared for ${cfg.owner}/${cfg.repo}@${cfg.ref}`);
  }
}

/**
 * Download and extract the given GitHub repo/ref using GitHub's codeload endpoint.
 * Returns the path to the extracted repo root folder.
 */
export async function getExtractedRepoRoot(
  context: vscode.ExtensionContext,
  cfg: LibraryConfig,
  forceRefresh: boolean = false
): Promise<string> {
  const storage = context.globalStorageUri.fsPath || path.join(os.tmpdir(), 'vscode-skills-importer');
  const cacheRoot = path.join(storage, 'repo-cache');
  ensureDirSync(cacheRoot);

  const cacheKey = sanitizeForPath(`${cfg.owner}__${cfg.repo}__${cfg.ref}`);
  const cacheDir = path.join(cacheRoot, cacheKey);
  const metaPath = path.join(cacheDir, 'meta.json');
  const extractedBase = path.join(cacheDir, 'extracted');

  const ttlMs = Math.max(0, cfg.cacheTtlHours) * 60 * 60 * 1000;

  // Check cache unless forced refresh
  if (!forceRefresh && ttlMs > 0 && fs.existsSync(metaPath) && fs.existsSync(extractedBase)) {
    try {
      const meta: RepoCacheMeta = JSON.parse(await fs.promises.readFile(metaPath, 'utf8'));
      const createdAtMs = new Date(meta.createdAt).getTime();
      if (!Number.isNaN(createdAtMs) && Date.now() - createdAtMs < ttlMs) {
        const repoRoot = path.join(extractedBase, meta.extractedRootFolder);
        if (fs.existsSync(repoRoot)) {
          logInfo(`Using cached repo: ${repoRoot}`);
          return repoRoot;
        }
      }
    } catch {
      // ignore cache parsing failures
    }
  }

  // Refresh cache
  await rmRf(cacheDir);
  ensureDirSync(cacheDir);
  ensureDirSync(extractedBase);

  const archivePath = path.join(cacheDir, 'repo.tgz');
  const codeloadUrl = `https://codeload.github.com/${cfg.owner}/${cfg.repo}/tar.gz/${encodeURIComponent(cfg.ref)}`;

  // Try to get GitHub token for authenticated requests (private repos)
  const token = await getGitHubToken();

  logInfo(`Downloading ${codeloadUrl}${token ? ' (authenticated)' : ''}`);

  try {
    await downloadToFile(codeloadUrl, archivePath, token);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === 'AUTH_REQUIRED' && !token) {
      // Rethrow with more helpful message
      throw new Error(
        `Cannot access ${cfg.owner}/${cfg.repo}. ` +
        'If this is a private repository, please sign in to GitHub first ' +
        'using the "Skills: Sign in to GitHub" command.'
      );
    }
    throw e;
  }

  logInfo(`Extracting archive to ${extractedBase}`);
  await tar.x({
    file: archivePath,
    cwd: extractedBase
  });

  // Find the single root folder
  const entries = await fs.promises.readdir(extractedBase, { withFileTypes: true });
  const rootFolder = entries.find((e) => e.isDirectory())?.name;
  if (!rootFolder) {
    throw new Error('Failed to find extracted repo root folder.');
  }

  const meta: RepoCacheMeta = {
    createdAt: new Date().toISOString(),
    extractedRootFolder: rootFolder
  };
  await fs.promises.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');

  const repoRoot = path.join(extractedBase, rootFolder);
  logInfo(`Repo extracted to ${repoRoot}`);
  return repoRoot;
}
