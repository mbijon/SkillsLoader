import * as vscode from 'vscode';

import { getLogChannel } from './log';
import { createSkillsTreeView, SkillsTreeDataProvider, SkillTreeItem } from './skillsTreeProvider';
import { createStatusBarItem, showQuickActions, updateStatusBar } from './statusBar';
import {
  installFromLibrary,
  updateInstalledSkills,
  refreshCache,
  clearAllCache,
  signInToGitHub,
  signOutOfGitHub,
  openSkillSettings
} from './commands';
import { removeInstalledSkills, removeSkillFromTree } from './commands/removeInstalledSkills';
import { openInExplorer, openSkillMarkdown, copySkillPath } from './commands/navigationCommands';

let treeProvider: SkillsTreeDataProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const ch = getLogChannel();
  ch.appendLine('Skills Importer activated');

  // Create tree view for installed skills
  const { provider } = createSkillsTreeView(context);
  treeProvider = provider;

  // Create status bar item
  createStatusBarItem(context);

  // Register core commands
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

  // Cache management commands
  context.subscriptions.push(
    vscode.commands.registerCommand('skillsImporter.refreshCache', async () => {
      await refreshCache(context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('skillsImporter.clearCache', async () => {
      await clearAllCache(context);
    })
  );

  // Authentication commands
  context.subscriptions.push(
    vscode.commands.registerCommand('skillsImporter.signIn', async () => {
      await signInToGitHub();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('skillsImporter.signOut', async () => {
      await signOutOfGitHub();
    })
  );

  // Navigation commands
  context.subscriptions.push(
    vscode.commands.registerCommand('skillsImporter.openSettings', async () => {
      await openSkillSettings();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('skillsImporter.showQuickActions', async () => {
      await showQuickActions();
    })
  );

  // Tree view commands
  context.subscriptions.push(
    vscode.commands.registerCommand('skillsImporter.refreshTree', () => {
      treeProvider?.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('skillsImporter.removeSkillFromTree', async (item: SkillTreeItem) => {
      await removeSkillFromTree(item);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('skillsImporter.openInExplorer', async (item: SkillTreeItem) => {
      await openInExplorer(item);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('skillsImporter.openSkillMarkdown', async (item: SkillTreeItem) => {
      await openSkillMarkdown(item);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('skillsImporter.copySkillPath', async (item: SkillTreeItem) => {
      await copySkillPath(item);
    })
  );

  // Listen for authentication changes
  context.subscriptions.push(
    vscode.authentication.onDidChangeSessions(async (e) => {
      if (e.provider.id === 'github') {
        await updateStatusBar();
      }
    })
  );

  // Initial status bar update
  void updateStatusBar();

  ch.appendLine('Skills Importer ready');
}

export function deactivate(): void {
  // Cleanup handled by disposables in context.subscriptions
}
