import * as vscode from 'vscode';

import { pickWorkspaceFolder } from '../workspace';
import { removeFromLockFile } from '../lockFile';
import { ensureWorkspaceTrustedOrConfirm, getSkillsBaseUri, uriExists } from './utils';
import { SkillTreeItem } from '../skillsTreeProvider';

/**
 * Remove installed skills from the workspace.
 */
export async function removeInstalledSkills(): Promise<void> {
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

  interface SkillPickItem extends vscode.QuickPickItem {
    skillName: string;
  }

  const picks = await vscode.window.showQuickPick<SkillPickItem>(
    dirs.map((d) => ({ label: d, skillName: d })),
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
    const destSkillUri = vscode.Uri.joinPath(skillsBaseUri, p.skillName);
    await vscode.workspace.fs.delete(destSkillUri, { recursive: true, useTrash: false });
  }

  await removeFromLockFile(folder.uri, picks.map((p) => p.skillName));

  // Fire tree refresh event
  await vscode.commands.executeCommand('skillsImporter.refreshTree');

  void vscode.window.showInformationMessage(`Removed ${picks.length} skill(s).`);
}

/**
 * Remove a specific skill from the tree view context menu.
 */
export async function removeSkillFromTree(item: SkillTreeItem): Promise<void> {
  if (!item) {
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Remove skill '${item.skillName}' from .github/skills/?`,
    { modal: true },
    'Remove',
    'Cancel'
  );
  if (confirm !== 'Remove') {
    return;
  }

  const skillsBaseUri = getSkillsBaseUri(item.workspaceFolder.uri);
  const destSkillUri = vscode.Uri.joinPath(skillsBaseUri, item.skillName);

  await vscode.workspace.fs.delete(destSkillUri, { recursive: true, useTrash: false });
  await removeFromLockFile(item.workspaceFolder.uri, [item.skillName]);

  // Fire tree refresh event
  await vscode.commands.executeCommand('skillsImporter.refreshTree');

  void vscode.window.showInformationMessage(`Removed skill '${item.skillName}'.`);
}
