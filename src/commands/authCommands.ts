import * as vscode from 'vscode';

import {
  signInToGitHub as doSignIn,
  clearCachedSession,
  getGitHubUsername,
  isGitHubAuthenticated
} from '../githubAuth';
import { updateStatusBar } from '../statusBar';
import { logInfo } from '../log';

/**
 * Sign in to GitHub for private repository access.
 */
export async function signInToGitHub(): Promise<void> {
  const session = await doSignIn();

  if (session) {
    void vscode.window.showInformationMessage(
      `Signed in to GitHub as ${session.account.label}. You can now access private repositories.`
    );
    await updateStatusBar();
  }
}

/**
 * Sign out of GitHub.
 */
export async function signOutOfGitHub(): Promise<void> {
  const isAuth = await isGitHubAuthenticated();
  if (!isAuth) {
    void vscode.window.showInformationMessage('Not currently signed in to GitHub.');
    return;
  }

  const username = await getGitHubUsername();

  // Clear the cached session (VSCode manages the actual auth state)
  clearCachedSession();
  logInfo('GitHub session cleared');

  void vscode.window.showInformationMessage(
    `Signed out of GitHub${username ? ` (${username})` : ''}. ` +
    'Note: To fully revoke access, use VSCode\'s Accounts menu.'
  );

  await updateStatusBar();
}
