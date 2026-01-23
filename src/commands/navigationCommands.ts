import * as vscode from 'vscode';

import { SkillTreeItem } from '../skillsTreeProvider';

/**
 * Open the skill folder in the file explorer.
 */
export async function openInExplorer(item: SkillTreeItem): Promise<void> {
  if (!item || !item.resourceUri) {
    return;
  }

  await vscode.commands.executeCommand('revealInExplorer', item.resourceUri);
}

/**
 * Reveal a skill in the tree view.
 */
export async function revealSkillInTree(
  treeView: vscode.TreeView<unknown>,
  item: SkillTreeItem
): Promise<void> {
  if (!item) {
    return;
  }

  await treeView.reveal(item, { select: true, focus: true });
}

/**
 * Open extension settings.
 */
export async function openSkillSettings(): Promise<void> {
  await vscode.commands.executeCommand(
    'workbench.action.openSettings',
    '@ext:local-dev.skills-importer'
  );
}

/**
 * Open a skill's SKILL.md file.
 */
export async function openSkillMarkdown(item: SkillTreeItem): Promise<void> {
  if (!item) {
    return;
  }

  const skillMdUri = vscode.Uri.joinPath(
    item.workspaceFolder.uri,
    '.github',
    'skills',
    item.skillName,
    'SKILL.md'
  );

  try {
    const doc = await vscode.workspace.openTextDocument(skillMdUri);
    await vscode.window.showTextDocument(doc, { preview: false });
  } catch {
    void vscode.window.showErrorMessage(`Could not open SKILL.md for '${item.skillName}'`);
  }
}

/**
 * Copy skill path to clipboard.
 */
export async function copySkillPath(item: SkillTreeItem): Promise<void> {
  if (!item || !item.resourceUri) {
    return;
  }

  await vscode.env.clipboard.writeText(item.resourceUri.fsPath);
  void vscode.window.showInformationMessage(`Copied path for '${item.skillName}' to clipboard.`);
}
