import * as vscode from 'vscode';

import { getLibraryConfig } from '../config';
import { getExtractedRepoRoot } from '../githubRepoCache';
import { loadSkillsFromRepo } from '../skillsCatalog';
import { pickWorkspaceFolder } from '../workspace';
import { copyDirectoryToWorkspace } from '../copyToWorkspace';
import { logError, logInfo } from '../log';
import { readLockFile, writeLockFile } from '../lockFile';
import { ensureWorkspaceTrustedOrConfirm, getSkillsBaseUri, uriExists } from './utils';

/**
 * Update installed skills from the library.
 */
export async function updateInstalledSkills(context: vscode.ExtensionContext): Promise<void> {
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

  interface SkillPickItem extends vscode.QuickPickItem {
    skillName: string;
  }

  const picks = await vscode.window.showQuickPick<SkillPickItem>(
    installedNames.map((name) => ({
      label: name,
      description: lock.installed[name]?.sourceSkillPath,
      picked: false,
      skillName: name
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
      title: `Updating skills from ${library.owner}/${library.repo}@${library.ref}...`,
      cancellable: true
    },
    async (progress, token) => {
      try {
        if (token.isCancellationRequested) {
          return;
        }

        progress.report({ message: 'Downloading repository...' });
        const repoRoot = await getExtractedRepoRoot(context, library, true); // Force refresh

        if (token.isCancellationRequested) {
          return;
        }

        progress.report({ message: 'Scanning for skills...' });
        const allSkills = await loadSkillsFromRepo(repoRoot, library.path);
        const byName = new Map(allSkills.map((s) => [s.name, s]));

        const skillsBaseUri = getSkillsBaseUri(folder.uri);
        await vscode.workspace.fs.createDirectory(skillsBaseUri);

        let updatedCount = 0;
        let skippedCount = 0;

        for (const p of picks) {
          if (token.isCancellationRequested) {
            return;
          }

          const s = byName.get(p.skillName);
          if (!s) {
            logInfo(`Skill '${p.skillName}' not found in library at current ref; skipping.`);
            skippedCount++;
            continue;
          }

          progress.report({ message: `Updating ${s.name}...` });

          const destSkillUri = vscode.Uri.joinPath(skillsBaseUri, s.name);
          if (await uriExists(destSkillUri)) {
            await vscode.workspace.fs.delete(destSkillUri, { recursive: true, useTrash: false });
          }
          await copyDirectoryToWorkspace(s.absSkillDir, destSkillUri);
          updatedCount++;
        }

        // Refresh lockfile timestamps
        await writeLockFile(
          folder.uri,
          library,
          picks.map((p) => ({
            skillName: p.skillName,
            sourceSkillPath: lock.installed[p.skillName]?.sourceSkillPath ?? ''
          }))
        );

        // Fire tree refresh event
        await vscode.commands.executeCommand('skillsImporter.refreshTree');

        let message = `Updated ${updatedCount} skill(s).`;
        if (skippedCount > 0) {
          message += ` ${skippedCount} skill(s) not found in library.`;
        }
        void vscode.window.showInformationMessage(message);
      } catch (e) {
        logError('Update failed', e);
        void vscode.window.showErrorMessage(`Failed to update skills: ${(e as Error).message}`);
      }
    }
  );
}
