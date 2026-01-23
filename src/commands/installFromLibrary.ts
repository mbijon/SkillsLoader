import * as vscode from 'vscode';
import * as path from 'path';

import { getLibraryConfig } from '../config';
import { getExtractedRepoRoot } from '../githubRepoCache';
import { loadSkillsFromRepo } from '../skillsCatalog';
import { pickWorkspaceFolder } from '../workspace';
import { copyDirectoryToWorkspace } from '../copyToWorkspace';
import { logError, logInfo } from '../log';
import { writeLockFile } from '../lockFile';
import { SkillSummary } from '../types';
import { ensureWorkspaceTrustedOrConfirm, getSkillsBaseUri, uriExists } from './utils';

/**
 * Install a skill from the configured library.
 */
export async function installFromLibrary(context: vscode.ExtensionContext): Promise<void> {
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
      title: `Fetching skills from ${library.owner}/${library.repo}@${library.ref}...`,
      cancellable: true
    },
    async (progress, token) => {
      try {
        if (token.isCancellationRequested) {
          return;
        }

        progress.report({ message: 'Downloading repository...' });
        const repoRoot = await getExtractedRepoRoot(context, library);

        if (token.isCancellationRequested) {
          return;
        }

        progress.report({ message: 'Scanning for skills...' });
        const skills = await loadSkillsFromRepo(repoRoot, library.path);

        if (skills.length === 0) {
          void vscode.window.showWarningMessage(
            `No skills found under '${library.path}' in ${library.owner}/${library.repo}@${library.ref}.`
          );
          return;
        }

        const selected = await pickSkill(skills, `${library.owner}/${library.repo}`);
        if (!selected || token.isCancellationRequested) {
          return;
        }

        // Preview SKILL.md
        await previewSkillMarkdown(selected);

        // Confirm install (extra warning if scripts)
        const confirmed = await confirmInstall(selected);
        if (!confirmed) {
          return;
        }

        progress.report({ message: `Installing ${selected.name}...` });
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

        // Fire tree refresh event
        await vscode.commands.executeCommand('skillsImporter.refreshTree');
      } catch (e) {
        logError('Install failed', e);
        void vscode.window.showErrorMessage(`Failed to install skill: ${(e as Error).message}`);
      }
    }
  );
}

async function pickSkill(skills: SkillSummary[], libraryLabel: string): Promise<SkillSummary | undefined> {
  interface SkillQuickPickItem extends vscode.QuickPickItem {
    skill: SkillSummary;
  }

  const pick = await vscode.window.showQuickPick<SkillQuickPickItem>(
    skills.map((s) => ({
      label: s.name,
      description: s.description,
      detail: `${libraryLabel}/${s.repoRelativeDir}${s.hasScripts ? '  $(warning) includes scripts' : ''}`,
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

  logInfo(`Copying '${skill.repoRelativeDir}' -> '.github/skills/${skill.name}'`);
  await copyDirectoryToWorkspace(skill.absSkillDir, destSkillUri);

  // Update lock file
  await writeLockFile(workspaceFolderUri, library, [
    {
      skillName: skill.name,
      sourceSkillPath: skill.repoRelativeDir
    }
  ]);
}
