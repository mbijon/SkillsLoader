import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Recursively copy a local (extension-host) directory to a VS Code workspace URI.
 * Uses `vscode.workspace.fs` for destination so it works for remote workspaces.
 */
export async function copyDirectoryToWorkspace(srcDir: string, destDir: vscode.Uri): Promise<void> {
  await vscode.workspace.fs.createDirectory(destDir);

  const entries = await fs.promises.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    // Skip VCS directories just in case
    if (entry.name === '.git') {
      continue;
    }

    const srcPath = path.join(srcDir, entry.name);
    const destPath = vscode.Uri.joinPath(destDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectoryToWorkspace(srcPath, destPath);
    } else if (entry.isFile()) {
      const bytes = await fs.promises.readFile(srcPath);
      await vscode.workspace.fs.writeFile(destPath, bytes);
    } else {
      // Ignore symlinks and other special filesystem entries for now
      continue;
    }
  }
}
