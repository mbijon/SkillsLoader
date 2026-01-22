import * as vscode from 'vscode';

const SKILLS_BASE_DIR_SEGMENTS = ['.github', 'skills'] as const;

/**
 * Ensure workspace is trusted or get user confirmation to proceed.
 */
export async function ensureWorkspaceTrustedOrConfirm(): Promise<boolean> {
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

/**
 * Get the base URI for the skills directory in a workspace.
 */
export function getSkillsBaseUri(workspaceFolderUri: vscode.Uri): vscode.Uri {
  return vscode.Uri.joinPath(workspaceFolderUri, ...SKILLS_BASE_DIR_SEGMENTS);
}

/**
 * Check if a URI exists.
 */
export async function uriExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get skills base directory segments.
 */
export function getSkillsBaseDirSegments(): readonly string[] {
  return SKILLS_BASE_DIR_SEGMENTS;
}
