import * as vscode from 'vscode';

import { getLibraryConfig } from '../config';
import { clearCache, clearCacheForLibrary, getExtractedRepoRoot } from '../githubRepoCache';
import { logError } from '../log';

/**
 * Refresh the library cache (re-download from GitHub).
 */
export async function refreshCache(context: vscode.ExtensionContext): Promise<void> {
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
      title: `Refreshing ${library.owner}/${library.repo}@${library.ref}...`,
      cancellable: false
    },
    async () => {
      try {
        // Clear and re-download
        await clearCacheForLibrary(context, library);
        await getExtractedRepoRoot(context, library, true);

        void vscode.window.showInformationMessage(
          `Library cache refreshed for ${library.owner}/${library.repo}@${library.ref}`
        );
      } catch (e) {
        logError('Cache refresh failed', e);
        void vscode.window.showErrorMessage(`Failed to refresh cache: ${(e as Error).message}`);
      }
    }
  );
}

/**
 * Clear all cached repositories.
 */
export async function clearAllCache(context: vscode.ExtensionContext): Promise<void> {
  const confirm = await vscode.window.showWarningMessage(
    'Clear all cached skill repositories? You will need to re-download when installing or updating skills.',
    { modal: true },
    'Clear Cache',
    'Cancel'
  );

  if (confirm !== 'Clear Cache') {
    return;
  }

  try {
    await clearCache(context);
    void vscode.window.showInformationMessage('All cached repositories cleared.');
  } catch (e) {
    logError('Clear cache failed', e);
    void vscode.window.showErrorMessage(`Failed to clear cache: ${(e as Error).message}`);
  }
}
