import * as vscode from 'vscode';
import { LibraryConfig, SkillsLockFileV1 } from './types';

const LOCK_FILE_NAME = '.skills-lock.json';

export function getLockFileUri(workspaceFolderUri: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(workspaceFolderUri, '.github', 'skills', LOCK_FILE_NAME);
}

export async function readLockFile(workspaceFolderUri: vscode.Uri): Promise<SkillsLockFileV1 | undefined> {
  const lockUri = getLockFileUri(workspaceFolderUri);
  try {
    const bytes = await vscode.workspace.fs.readFile(lockUri);
    const text = Buffer.from(bytes).toString('utf8');
    const parsed = JSON.parse(text) as SkillsLockFileV1;
    if (parsed && parsed.version === 1) {
      return parsed;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function writeLockFile(
  workspaceFolderUri: vscode.Uri,
  library: LibraryConfig,
  updates: { skillName: string; sourceSkillPath: string }[]
): Promise<void> {
  const existing = await readLockFile(workspaceFolderUri);
  const base: SkillsLockFileV1 = existing ?? {
    version: 1,
    library: {
      owner: library.owner,
      repo: library.repo,
      ref: library.ref,
      path: library.path
    },
    installed: {}
  };

  // Keep library info up to date
  base.library = {
    owner: library.owner,
    repo: library.repo,
    ref: library.ref,
    path: library.path
  };

  for (const u of updates) {
    base.installed[u.skillName] = {
      sourceSkillPath: u.sourceSkillPath,
      installedAt: new Date().toISOString()
    };
  }

  const lockUri = getLockFileUri(workspaceFolderUri);
  const text = JSON.stringify(base, null, 2) + '\n';
  await vscode.workspace.fs.writeFile(lockUri, Buffer.from(text, 'utf8'));
}

export async function removeFromLockFile(workspaceFolderUri: vscode.Uri, skillNames: string[]): Promise<void> {
  const existing = await readLockFile(workspaceFolderUri);
  if (!existing) {
    return;
  }
  for (const n of skillNames) {
    delete existing.installed[n];
  }
  const lockUri = getLockFileUri(workspaceFolderUri);
  const text = JSON.stringify(existing, null, 2) + '\n';
  await vscode.workspace.fs.writeFile(lockUri, Buffer.from(text, 'utf8'));
}
