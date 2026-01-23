import * as vscode from 'vscode';
import { logInfo, logError } from './log';

/**
 * GitHub authentication provider using VSCode's built-in GitHub auth.
 * This enables access to private repositories when the user authenticates.
 */

const GITHUB_AUTH_PROVIDER_ID = 'github';
const SCOPES = ['repo'];

let cachedSession: vscode.AuthenticationSession | undefined;

/**
 * Get a GitHub authentication session if available.
 * Returns undefined if the user hasn't authenticated or declined.
 */
export async function getGitHubSession(
  createIfNone: boolean = false
): Promise<vscode.AuthenticationSession | undefined> {
  if (cachedSession) {
    return cachedSession;
  }

  try {
    const session = await vscode.authentication.getSession(
      GITHUB_AUTH_PROVIDER_ID,
      SCOPES,
      { createIfNone }
    );

    if (session) {
      cachedSession = session;
      logInfo(`GitHub authenticated as ${session.account.label}`);
    }

    return session;
  } catch (e) {
    if (e instanceof Error && e.message.includes('User did not consent')) {
      logInfo('User declined GitHub authentication');
      return undefined;
    }
    logError('Failed to get GitHub session', e);
    return undefined;
  }
}

/**
 * Get GitHub token if authenticated, or undefined if not.
 * This does NOT prompt the user to authenticate.
 */
export async function getGitHubToken(): Promise<string | undefined> {
  const session = await getGitHubSession(false);
  return session?.accessToken;
}

/**
 * Prompt the user to sign in to GitHub.
 * Returns the session if successful, undefined otherwise.
 */
export async function signInToGitHub(): Promise<vscode.AuthenticationSession | undefined> {
  return getGitHubSession(true);
}

/**
 * Clear the cached session (for sign-out functionality).
 */
export function clearCachedSession(): void {
  cachedSession = undefined;
}

/**
 * Check if we have an active GitHub session.
 */
export async function isGitHubAuthenticated(): Promise<boolean> {
  const session = await getGitHubSession(false);
  return session !== undefined;
}

/**
 * Get the authenticated user's GitHub username, if available.
 */
export async function getGitHubUsername(): Promise<string | undefined> {
  const session = await getGitHubSession(false);
  return session?.account.label;
}
