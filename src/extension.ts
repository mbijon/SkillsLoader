import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { getLibraryConfig } from './config';
import { getExtractedRepoRoot } from './githubRepoCache';
import { loadSkillsFromRepo } from './skillsCatalog';
import { pickWorkspaceFolder } from './workspace';
import { copyDirectoryToWorkspace } from './copyToWorkspace';
import { getLogChannel, logError, logInfo } from './log';
import { removeFromLockFile, readLockFile, writeLockFile } from './lockFile';
import { SkillSummary } from './types';

const SKILLS_BASE_DIR_SEGMENTS = ['.github', 'skills'] as const;

export function activate(context: vscode.ExtensionContext) {
  const ch = getLogChannel();
  ch.appendLine('Skills Importer activated');

  context.subscriptions.push(
    vscode.commands.registerCommand('skillsImporter.installFromLibrary', async () => {
      await installFromLibrary(context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('skillsImporter.updateInstalledSkills', async () => {
      await updateInstalledSkills(context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('skillsImporter.removeInstalledSkill', async () => {
      await removeInstalledSkills();
    })
  );
}

export function deactivate() {
  // no-op
}

async function ensureWorkspaceTrustedOrConfirm(): Promise<boolean> {
  if (vscode.workspace.isTrusted) {
    return true;
  }
  const choice = await vscode.window.showWarningMessage(
    'This workspace is in Restricted Mode. Installing a skill can add scripts/files to the workspace. Continue?',
    { modal: true },
    'Continue'
  );
  return choice === 'Continue';
}

function getSkillsBaseUri(workspaceFolderUri: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(workspaceFolderUri, ...SKILLS_BASE_DIR_SEGMENTS);
}

async function uriExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

async function installFromLibrary(context: vscode.ExtensionContext): Promise<void> {
  const folder = await pickWorkspaceFolder();
  if (!folder) {
    return;
  }

  if (!(await ensureWorkspaceTrustedOrConfirm())) {
    return;
  }

  let library;
  try {
    library = getLibraryConfig();
  } catch (e) {
    void vscode.window.showErrorMessage((e as Error).message);
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Fetching skills from ${library.owner}/${library.repo}@${library.ref}…`,
      cancellable: false
    },
    async () => {
      try {
        const repoRoot = await getExtractedRepoRoot(context, library);
        const skills = await loadSkillsFromRepo(repoRoot, library.path);

        if (skills.length === 0) {
          void vscode.window.showWarningMessage(
            `No skills found under '${library.path}' in ${library.owner}/${library.repo}@${library.ref}.`
          );
          return;
        }

        const selected = await pickSkill(skills, `${library.owner}/${library.repo}`);
        if (!selected) {
          return;
        }

        // Preview SKILL.md
        await previewSkillMarkdown(selected);

        // Confirm install (extra warning if scripts)
        const confirmed = await confirmInstall(selected);
        if (!confirmed) {
          return;
        }

        await installSkillIntoWorkspace(folder.uri, selected, library);

        // Open installed SKILL.md
        const installedSkillMdUri = vscode.Uri.joinPath(
          getSkillsBaseUri(folder.uri),
          selected.name,
          'SKILL.md'
        );
        if (await uriExists(installedSkillMdUri)) {
          const doc = await vscode.workspace.openTextDocument(installedSkillMdUri);
          await vscode.window.showTextDocument(doc, { preview: false });
        }

        void vscode.window.showInformationMessage(
          `Installed skill '${selected.name}' into ${path.join(folder.uri.fsPath, '.github', 'skills')}`
        );
      } catch (e) {
        logError('Install failed', e);
        void vscode.window.showErrorMessage(`Failed to install skill: ${(e as Error).message}`);
      }
    }
  );
}

async function pickSkill(skills: SkillSummary[], libraryLabel: string): Promise<SkillSummary | undefined> {
  const pick = await vscode.window.showQuickPick(
    skills.map((s) => ({
      label: s.name,
      description: s.description,
      detail: `${libraryLabel}/${s.repoRelativeDir}${s.hasScripts ? '  •  includes scripts' : ''}`,
      skill: s
    })),
    {
      title: 'Install an Agent Skill',
      placeHolder: `Search skills from ${libraryLabel}`,
      matchOnDescription: true,
      matchOnDetail: true
    }
  );

  return pick?.skill;
}

async function previewSkillMarkdown(skill: SkillSummary): Promise<void> {
  const doc = await vscode.workspace.openTextDocument({ content: skill.skillMdText, language: 'markdown' });
  await vscode.window.showTextDocument(doc, { preview: true });
}

async function confirmInstall(skill: SkillSummary): Promise<boolean> {
  if (skill.hasScripts) {
    const choice = await vscode.window.showWarningMessage(
      `The skill '${skill.name}' appears to include scripts. Only install skills you trust. Install into .github/skills/?`,
      { modal: true },
      'Install',
      'Cancel'
    );
    return choice === 'Install';
  }

  const choice = await vscode.window.showInformationMessage(
    `Install skill '${skill.name}' into .github/skills/?`,
    { modal: true },
    'Install',
    'Cancel'
  );
  return choice === 'Install';
}

async function installSkillIntoWorkspace(
  workspaceFolderUri: vscode.Uri,
  skill: SkillSummary,
  library: ReturnType<typeof getLibraryConfig>
): Promise<void> {
  const skillsBaseUri = getSkillsBaseUri(workspaceFolderUri);
  await vscode.workspace.fs.createDirectory(skillsBaseUri);

  const destSkillUri = vscode.Uri.joinPath(skillsBaseUri, skill.name);
  if (await uriExists(destSkillUri)) {
    const choice = await vscode.window.showWarningMessage(
      `A skill folder already exists at .github/skills/${skill.name}. Overwrite it?`,
      { modal: true },
      'Overwrite',
      'Cancel'
    );
    if (choice !== 'Overwrite') {
      throw new Error('Install cancelled.');
    }
    await vscode.workspace.fs.delete(destSkillUri, { recursive: true, useTrash: false });
  }

  logInfo(`Copying '${skill.repoRelativeDir}' → '.github/skills/${skill.name}'`);
  await copyDirectoryToWorkspace(skill.absSkillDir, destSkillUri);

  // Update lock file
  await writeLockFile(workspaceFolderUri, library, [
    {
      skillName: skill.name,
      sourceSkillPath: skill.repoRelativeDir
    }
  ]);
}

async function updateInstalledSkills(context: vscode.ExtensionContext): Promise<void> {
  const folder = await pickWorkspaceFolder();
  if (!folder) {
    return;
  }

  if (!(await ensureWorkspaceTrustedOrConfirm())) {
    return;
  }

  let library;
  try {
    library = getLibraryConfig();
  } catch (e) {
    void vscode.window.showErrorMessage((e as Error).message);
    return;
  }

  const lock = await readLockFile(folder.uri);
  if (!lock || !lock.installed || Object.keys(lock.installed).length === 0) {
    void vscode.window.showInformationMessage(
      'No installed skills found in .github/skills/.skills-lock.json. Install a skill first.'
    );
    return;
  }

  // Note: lock may refer to a different library config than current settings.
  const installedNames = Object.keys(lock.installed).sort();

  const picks = await vscode.window.showQuickPick(
    installedNames.map((name) => ({
      label: name,
      description: lock.installed[name]?.sourceSkillPath,
      picked: false
    })),
    {
      title: 'Select installed skills to update',
      canPickMany: true,
      placeHolder: 'Choose one or more skills'
    }
  );

  if (!picks || picks.length === 0) {
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    'Updating will overwrite the selected skill folders under .github/skills/. Continue?',
    { modal: true },
    'Update',
    'Cancel'
  );
  if (confirm !== 'Update') {
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Updating skills from ${library.owner}/${library.repo}@${library.ref}…`,
      cancellable: false
    },
    async () => {
      try {
        const repoRoot = await getExtractedRepoRoot(context, library);
        const allSkills = await loadSkillsFromRepo(repoRoot, library.path);
        const byName = new Map(allSkills.map((s) => [s.name, s]));

        const skillsBaseUri = getSkillsBaseUri(folder.uri);
        await vscode.workspace.fs.createDirectory(skillsBaseUri);

        for (const p of picks) {
          const s = byName.get(p.label);
          if (!s) {
            logInfo(`Skill '${p.label}' not found in library at current ref; skipping.`);
            continue;
          }

          const destSkillUri = vscode.Uri.joinPath(skillsBaseUri, s.name);
          if (await uriExists(destSkillUri)) {
            await vscode.workspace.fs.delete(destSkillUri, { recursive: true, useTrash: false });
          }
          await copyDirectoryToWorkspace(s.absSkillDir, destSkillUri);
        }

        // Refresh lockfile timestamps
        await writeLockFile(
          folder.uri,
          library,
          picks.map((p) => ({
            skillName: p.label,
            sourceSkillPath: lock.installed[p.label]?.sourceSkillPath ?? ''
          }))
        );

        void vscode.window.showInformationMessage(`Updated ${picks.length} skill(s).`);
      } catch (e) {
        logError('Update failed', e);
        void vscode.window.showErrorMessage(`Failed to update skills: ${(e as Error).message}`);
      }
    }
  );
}

async function removeInstalledSkills(): Promise<void> {
  const folder = await pickWorkspaceFolder();
  if (!folder) {
    return;
  }

  if (!(await ensureWorkspaceTrustedOrConfirm())) {
    return;
  }

  const skillsBaseUri = getSkillsBaseUri(folder.uri);
  if (!(await uriExists(skillsBaseUri))) {
    void vscode.window.showInformationMessage('No .github/skills folder found in this workspace.');
    return;
  }

  // List child directories under .github/skills
  const entries = await vscode.workspace.fs.readDirectory(skillsBaseUri);
  const dirs = entries
    .filter(([, type]) => type === vscode.FileType.Directory)
    .map(([name]) => name)
    .sort();

  if (dirs.length === 0) {
    void vscode.window.showInformationMessage('No installed skills found under .github/skills/.');
    return;
  }

  const picks = await vscode.window.showQuickPick(
    dirs.map((d) => ({ label: d })),
    {
      title: 'Remove installed skills',
      canPickMany: true,
      placeHolder: 'Choose one or more skills to remove'
    }
  );

  if (!picks || picks.length === 0) {
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Remove ${picks.length} skill(s) from .github/skills/?`,
    { modal: true },
    'Remove',
    'Cancel'
  );
  if (confirm !== 'Remove') {
    return;
  }

  for (const p of picks) {
    const destSkillUri = vscode.Uri.joinPath(skillsBaseUri, p.label);
    await vscode.workspace.fs.delete(destSkillUri, { recursive: true, useTrash: false });
  }

  await removeFromLockFile(folder.uri, picks.map((p) => p.label));

  void vscode.window.showInformationMessage(`Removed ${picks.length} skill(s).`);
}
