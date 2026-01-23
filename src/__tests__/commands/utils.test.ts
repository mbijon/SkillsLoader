import { Uri, workspace, window } from 'vscode';
import {
  ensureWorkspaceTrustedOrConfirm,
  getSkillsBaseUri,
  uriExists,
  getSkillsBaseDirSegments
} from '../../commands/utils';

jest.mock('vscode');

describe('commands/utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Uri.joinPath as jest.Mock).mockImplementation((base, ...segments) => ({
      fsPath: [base.fsPath, ...segments].join('/'),
      path: [base.path, ...segments].join('/'),
      scheme: 'file',
      toString: () => `file://${[base.fsPath, ...segments].join('/')}`
    }));
  });

  describe('ensureWorkspaceTrustedOrConfirm', () => {
    it('should return true when workspace is trusted', async () => {
      Object.defineProperty(workspace, 'isTrusted', { value: true, configurable: true });

      const result = await ensureWorkspaceTrustedOrConfirm();

      expect(result).toBe(true);
      expect(window.showWarningMessage).not.toHaveBeenCalled();
    });

    it('should show warning and return true when user confirms', async () => {
      Object.defineProperty(workspace, 'isTrusted', { value: false, configurable: true });
      (window.showWarningMessage as jest.Mock).mockResolvedValue('Continue');

      const result = await ensureWorkspaceTrustedOrConfirm();

      expect(result).toBe(true);
      expect(window.showWarningMessage).toHaveBeenCalledWith(
        'This workspace is in Restricted Mode. Installing a skill can add scripts/files to the workspace. Continue?',
        { modal: true },
        'Continue'
      );
    });

    it('should return false when user cancels', async () => {
      Object.defineProperty(workspace, 'isTrusted', { value: false, configurable: true });
      (window.showWarningMessage as jest.Mock).mockResolvedValue(undefined);

      const result = await ensureWorkspaceTrustedOrConfirm();

      expect(result).toBe(false);
    });

    it('should return false when user clicks something other than Continue', async () => {
      Object.defineProperty(workspace, 'isTrusted', { value: false, configurable: true });
      (window.showWarningMessage as jest.Mock).mockResolvedValue('Cancel');

      const result = await ensureWorkspaceTrustedOrConfirm();

      expect(result).toBe(false);
    });
  });

  describe('getSkillsBaseUri', () => {
    it('should return correct URI for skills directory', () => {
      const mockWorkspaceUri = {
        fsPath: '/workspace/project',
        path: '/workspace/project',
        scheme: 'file'
      };

      const result = getSkillsBaseUri(mockWorkspaceUri as any);

      expect(Uri.joinPath).toHaveBeenCalledWith(
        mockWorkspaceUri,
        '.github',
        'skills'
      );
      expect(result.fsPath).toBe('/workspace/project/.github/skills');
    });
  });

  describe('uriExists', () => {
    it('should return true when URI exists', async () => {
      const mockUri = { fsPath: '/test/path', scheme: 'file' };
      (workspace.fs.stat as jest.Mock).mockResolvedValue({ type: 1 });

      const result = await uriExists(mockUri as any);

      expect(result).toBe(true);
      expect(workspace.fs.stat).toHaveBeenCalledWith(mockUri);
    });

    it('should return false when URI does not exist', async () => {
      const mockUri = { fsPath: '/test/path', scheme: 'file' };
      (workspace.fs.stat as jest.Mock).mockRejectedValue(new Error('File not found'));

      const result = await uriExists(mockUri as any);

      expect(result).toBe(false);
    });
  });

  describe('getSkillsBaseDirSegments', () => {
    it('should return correct directory segments', () => {
      const segments = getSkillsBaseDirSegments();

      expect(segments).toEqual(['.github', 'skills']);
    });

    it('should return consistent array values', () => {
      const segments1 = getSkillsBaseDirSegments();
      const segments2 = getSkillsBaseDirSegments();

      // Should return the same reference (constant)
      expect(segments1).toBe(segments2);
      expect(segments1.length).toBe(2);
    });
  });
});
