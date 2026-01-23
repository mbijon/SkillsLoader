import * as vscode from 'vscode';
import { isGitHubAuthenticated, getGitHubUsername } from './githubAuth';

let statusBarItem: vscode.StatusBarItem | undefined;

/**
 * Create and return the status bar item for the Skills Importer.
 */
export function createStatusBarItem(context: vscode.ExtensionContext): vscode.StatusBarItem {
  if (!statusBarItem) {
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    context.subscriptions.push(statusBarItem);
  }

  statusBarItem.command = 'skillsImporter.showQuickActions';
  updateStatusBar();
  statusBarItem.show();

  return statusBarItem;
}

/**
 * Update the status bar item text and tooltip.
 */
export async function updateStatusBar(): Promise<void> {
  if (!statusBarItem) {
    return;
  }

  const authenticated = await isGitHubAuthenticated();
  const username = authenticated ? await getGitHubUsername() : undefined;

  if (authenticated && username) {
    statusBarItem.text = '$(symbol-method) Skills';
    statusBarItem.tooltip = new vscode.MarkdownString(
      `**Skills Importer**\n\n` +
      `$(github) Signed in as **${username}**\n\n` +
      `Click for quick actions`
    );
    statusBarItem.backgroundColor = undefined;
  } else {
    statusBarItem.text = '$(symbol-method) Skills';
    statusBarItem.tooltip = new vscode.MarkdownString(
      `**Skills Importer**\n\n` +
      `$(warning) Not signed in to GitHub\n\n` +
      `Click for quick actions`
    );
    statusBarItem.backgroundColor = undefined;
  }
}

/**
 * Show quick actions menu from status bar.
 */
export async function showQuickActions(): Promise<void> {
  const authenticated = await isGitHubAuthenticated();

  interface QuickActionItem extends vscode.QuickPickItem {
    command: string;
  }

  const items: QuickActionItem[] = [
    {
      label: '$(add) Install from Library',
      description: 'Browse and install skills',
      command: 'skillsImporter.installFromLibrary'
    },
    {
      label: '$(sync) Update Installed Skills',
      description: 'Update selected skills to latest version',
      command: 'skillsImporter.updateInstalledSkills'
    },
    {
      label: '$(trash) Remove Installed Skill',
      description: 'Remove skills from workspace',
      command: 'skillsImporter.removeInstalledSkill'
    },
    {
      label: '$(refresh) Refresh Library Cache',
      description: 'Clear and re-download library',
      command: 'skillsImporter.refreshCache'
    }
  ];

  if (authenticated) {
    items.push({
      label: '$(sign-out) Sign Out of GitHub',
      description: 'Disconnect GitHub account',
      command: 'skillsImporter.signOut'
    });
  } else {
    items.push({
      label: '$(github) Sign in to GitHub',
      description: 'Required for private repositories',
      command: 'skillsImporter.signIn'
    });
  }

  items.push({
    label: '$(gear) Open Settings',
    description: 'Configure Skills Importer',
    command: 'skillsImporter.openSettings'
  });

  const selected = await vscode.window.showQuickPick(items, {
    title: 'Skills Importer',
    placeHolder: 'Select an action'
  });

  if (selected) {
    await vscode.commands.executeCommand(selected.command);
  }
}

/**
 * Dispose of the status bar item.
 */
export function disposeStatusBar(): void {
  if (statusBarItem) {
    statusBarItem.dispose();
    statusBarItem = undefined;
  }
}
