import * as vscode from 'vscode';

/**
 * Pick the appropriate workspace folder to operate on.
 *
 * Rules:
 * 1) If a single workspace folder is open, use it.
 * 2) If multiple folders, prefer the one containing the active editor file.
 * 3) Otherwise, prompt the user to pick a workspace folder.
 */
export async function pickWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    void vscode.window.showErrorMessage('No workspace folder is open. Open a folder first.');
    return undefined;
  }

  if (folders.length === 1) {
    return folders[0];
  }

  const activeUri = vscode.window.activeTextEditor?.document?.uri;
  if (activeUri) {
    const containing = vscode.workspace.getWorkspaceFolder(activeUri);
    if (containing) {
      return containing;
    }
  }

  const pick = await vscode.window.showQuickPick(
    folders.map((f) => ({
      label: f.name,
      description: f.uri.fsPath,
      folder: f
    })),
    {
      title: 'Select a workspace folder to install the skill into',
      placeHolder: 'Choose workspace folder'
    }
  );

  return pick?.folder;
}
