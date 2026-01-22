import { authentication } from 'vscode';
import {
  getGitHubSession,
  getGitHubToken,
  signInToGitHub,
  clearCachedSession,
  isGitHubAuthenticated,
  getGitHubUsername
} from '../githubAuth';

jest.mock('vscode');
jest.mock('../log', () => ({
  logInfo: jest.fn(),
  logError: jest.fn()
}));

describe('githubAuth', () => {
  const mockSession = {
    id: 'test-session-id',
    accessToken: 'ghp_testtoken123',
    account: {
      id: '12345',
      label: 'testuser'
    },
    scopes: ['repo']
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the cached session between tests
    clearCachedSession();
  });

  describe('getGitHubSession', () => {
    it('should return session when authentication succeeds', async () => {
      (authentication.getSession as jest.Mock).mockResolvedValue(mockSession);

      const result = await getGitHubSession(false);

      expect(result).toEqual(mockSession);
      expect(authentication.getSession).toHaveBeenCalledWith(
        'github',
        ['repo'],
        { createIfNone: false }
      );
    });

    it('should cache session and return cached on subsequent calls', async () => {
      (authentication.getSession as jest.Mock).mockResolvedValue(mockSession);

      const result1 = await getGitHubSession(false);
      const result2 = await getGitHubSession(false);

      expect(result1).toEqual(mockSession);
      expect(result2).toEqual(mockSession);
      // Should only call getSession once due to caching
      expect(authentication.getSession).toHaveBeenCalledTimes(1);
    });

    it('should return undefined when no session exists', async () => {
      (authentication.getSession as jest.Mock).mockResolvedValue(undefined);

      const result = await getGitHubSession(false);

      expect(result).toBeUndefined();
    });

    it('should return undefined when user declines authentication', async () => {
      (authentication.getSession as jest.Mock).mockRejectedValue(
        new Error('User did not consent to login')
      );

      const result = await getGitHubSession(true);

      expect(result).toBeUndefined();
    });

    it('should return undefined on other errors', async () => {
      (authentication.getSession as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const result = await getGitHubSession(false);

      expect(result).toBeUndefined();
    });

    it('should pass createIfNone=true when requested', async () => {
      (authentication.getSession as jest.Mock).mockResolvedValue(mockSession);

      await getGitHubSession(true);

      expect(authentication.getSession).toHaveBeenCalledWith(
        'github',
        ['repo'],
        { createIfNone: true }
      );
    });
  });

  describe('getGitHubToken', () => {
    it('should return token when authenticated', async () => {
      (authentication.getSession as jest.Mock).mockResolvedValue(mockSession);

      const token = await getGitHubToken();

      expect(token).toBe('ghp_testtoken123');
    });

    it('should return undefined when not authenticated', async () => {
      (authentication.getSession as jest.Mock).mockResolvedValue(undefined);

      const token = await getGitHubToken();

      expect(token).toBeUndefined();
    });

    it('should not prompt user to authenticate', async () => {
      (authentication.getSession as jest.Mock).mockResolvedValue(undefined);

      await getGitHubToken();

      expect(authentication.getSession).toHaveBeenCalledWith(
        'github',
        ['repo'],
        { createIfNone: false }
      );
    });
  });

  describe('signInToGitHub', () => {
    it('should prompt user and return session on success', async () => {
      (authentication.getSession as jest.Mock).mockResolvedValue(mockSession);

      const result = await signInToGitHub();

      expect(result).toEqual(mockSession);
      expect(authentication.getSession).toHaveBeenCalledWith(
        'github',
        ['repo'],
        { createIfNone: true }
      );
    });

    it('should return undefined when user cancels', async () => {
      (authentication.getSession as jest.Mock).mockResolvedValue(undefined);

      const result = await signInToGitHub();

      expect(result).toBeUndefined();
    });
  });

  describe('clearCachedSession', () => {
    it('should clear the cached session', async () => {
      (authentication.getSession as jest.Mock).mockResolvedValue(mockSession);

      // First call caches the session
      await getGitHubSession(false);
      expect(authentication.getSession).toHaveBeenCalledTimes(1);

      // Clear the cache
      clearCachedSession();

      // Next call should fetch again
      await getGitHubSession(false);
      expect(authentication.getSession).toHaveBeenCalledTimes(2);
    });
  });

  describe('isGitHubAuthenticated', () => {
    it('should return true when authenticated', async () => {
      (authentication.getSession as jest.Mock).mockResolvedValue(mockSession);

      const result = await isGitHubAuthenticated();

      expect(result).toBe(true);
    });

    it('should return false when not authenticated', async () => {
      (authentication.getSession as jest.Mock).mockResolvedValue(undefined);

      const result = await isGitHubAuthenticated();

      expect(result).toBe(false);
    });
  });

  describe('getGitHubUsername', () => {
    it('should return username when authenticated', async () => {
      (authentication.getSession as jest.Mock).mockResolvedValue(mockSession);

      const username = await getGitHubUsername();

      expect(username).toBe('testuser');
    });

    it('should return undefined when not authenticated', async () => {
      (authentication.getSession as jest.Mock).mockResolvedValue(undefined);

      const username = await getGitHubUsername();

      expect(username).toBeUndefined();
    });
  });
});
