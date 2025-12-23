import * as path from 'path';
import * as fs from 'fs';
import matter from 'gray-matter';
import { SkillSummary } from './types';

async function findFilesNamed(rootDir: string, fileName: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      // Skip common large/unneeded dirs
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.vscode') {
          continue;
        }
        await walk(path.join(dir, entry.name));
      } else if (entry.isFile()) {
        if (entry.name === fileName) {
          results.push(path.join(dir, entry.name));
        }
      }
    }
  }

  await walk(rootDir);
  return results;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function looksLikeScriptPath(p: string): boolean {
  const lowered = p.toLowerCase();
  return (
    lowered.includes(`${path.sep}scripts${path.sep}`) ||
    lowered.endsWith(`${path.sep}scripts`) ||
    lowered.endsWith('.sh') ||
    lowered.endsWith('.ps1') ||
    lowered.endsWith('.bat') ||
    lowered.endsWith('.cmd') ||
    lowered.endsWith('.py')
  );
}

async function directoryHasScripts(skillDir: string): Promise<boolean> {
  // Fast checks
  const scriptsDir = path.join(skillDir, 'scripts');
  if (fs.existsSync(scriptsDir) && (await fs.promises.stat(scriptsDir)).isDirectory()) {
    return true;
  }

  // Otherwise do a light recursive scan for common script extensions
  const stack: string[] = [skillDir];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === 'node_modules') {
          continue;
        }
        stack.push(p);
      } else if (entry.isFile()) {
        if (looksLikeScriptPath(p)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Scan a repo directory for skills by locating SKILL.md files under `skillsRootRelPath`.
 */
export async function loadSkillsFromRepo(repoRoot: string, skillsRootRelPath: string): Promise<SkillSummary[]> {
  const skillsRoot = path.join(repoRoot, skillsRootRelPath);
  if (!fs.existsSync(skillsRoot)) {
    throw new Error(`Skills root path does not exist in repo: ${skillsRootRelPath}`);
  }

  const manifests = await findFilesNamed(skillsRoot, 'SKILL.md');

  const skills: SkillSummary[] = [];
  for (const absSkillMd of manifests) {
    const absSkillDir = path.dirname(absSkillMd);
    const raw = await fs.promises.readFile(absSkillMd, 'utf8');

    let parsed;
    try {
      parsed = matter(raw);
    } catch (e) {
      // If frontmatter is invalid, skip it (don't crash listing)
      continue;
    }

    const name = (parsed.data as any)?.name;
    const description = (parsed.data as any)?.description;

    if (!isNonEmptyString(name) || !isNonEmptyString(description)) {
      continue;
    }

    const hasScripts = await directoryHasScripts(absSkillDir);
    const repoRelativeDir = path.relative(repoRoot, absSkillDir);

    skills.push({
      name: name.trim(),
      description: description.trim(),
      absSkillDir,
      absSkillMd,
      repoRelativeDir,
      hasScripts,
      skillMdText: raw
    });
  }

  // Sort for stable UX
  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}
