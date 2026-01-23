import * as vscode from 'vscode';
import { LibraryConfig } from './types';

export function getLibraryConfig(): LibraryConfig {
  const cfg = vscode.workspace.getConfiguration('skillsImporter');
  const lib = cfg.get<string>('library', 'anthropics/skills');
  const ref = cfg.get<string>('ref', 'main');
  const p = cfg.get<string>('path', 'skills');
  const ttl = cfg.get<number>('cache.ttlHours', 24);

  const [owner, repo] = lib.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid skillsImporter.library value: '${lib}'. Expected 'owner/repo'.`);
  }

  return {
    owner,
    repo,
    ref,
    path: p,
    cacheTtlHours: ttl
  };
}
