import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as https from 'https';
import * as tar from 'tar';
import { LibraryConfig } from './types';
import { logInfo } from './log';

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

async function downloadToFile(url: string, destPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'User-Agent': 'vscode-skills-importer'
      }
    }, (res) => {
      const status = res.statusCode ?? 0;

      // Handle redirects
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        void downloadToFile(res.headers.location, destPath).then(resolve, reject);
        return;
      }

      if (status < 200 || status >= 300) {
        res.resume();
        reject(new Error(`Download failed (${status}) for ${url}`));
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

    request.on('error', (err) => reject(err));
  });
}

/**
 * Download and extract the given GitHub repo/ref using GitHub's codeload endpoint.
 * Returns the path to the extracted repo root folder.
 */
export async function getExtractedRepoRoot(context: vscode.ExtensionContext, cfg: LibraryConfig): Promise<string> {
  const storage = context.globalStorageUri.fsPath || path.join(os.tmpdir(), 'vscode-skills-importer');
  const cacheRoot = path.join(storage, 'repo-cache');
  ensureDirSync(cacheRoot);

  const cacheKey = sanitizeForPath(`${cfg.owner}__${cfg.repo}__${cfg.ref}`);
  const cacheDir = path.join(cacheRoot, cacheKey);
  const metaPath = path.join(cacheDir, 'meta.json');
  const extractedBase = path.join(cacheDir, 'extracted');

  const ttlMs = Math.max(0, cfg.cacheTtlHours) * 60 * 60 * 1000;

  if (ttlMs > 0 && fs.existsSync(metaPath) && fs.existsSync(extractedBase)) {
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

  logInfo(`Downloading ${codeloadUrl}`);
  await downloadToFile(codeloadUrl, archivePath);

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
