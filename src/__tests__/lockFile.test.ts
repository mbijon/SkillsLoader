import { Uri, workspace } from 'vscode';
import { getLockFileUri, readLockFile, writeLockFile, removeFromLockFile } from '../lockFile';
import { LibraryConfig, SkillsLockFileV1 } from '../types';

jest.mock('vscode');

describe('lockFile', () => {
  const mockWorkspaceUri = {
    fsPath: '/workspace/project',
    path: '/workspace/project',
    scheme: 'file',
    toString: () => 'file:///workspace/project'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (Uri.joinPath as jest.Mock).mockImplementation((base, ...segments) => ({
      fsPath: [base.fsPath, ...segments].join('/'),
      path: [base.path, ...segments].join('/'),
      scheme: 'file',
      toString: () => `file://${[base.fsPath, ...segments].join('/')}`
    }));
  });

  describe('getLockFileUri', () => {
    it('should return correct lock file path', () => {
      const result = getLockFileUri(mockWorkspaceUri as any);

      expect(Uri.joinPath).toHaveBeenCalledWith(
        mockWorkspaceUri,
        '.github',
        'skills',
        '.skills-lock.json'
      );
      expect(result.fsPath).toBe('/workspace/project/.github/skills/.skills-lock.json');
    });
  });

  describe('readLockFile', () => {
    it('should return parsed lock file when valid', async () => {
      const mockLockFile: SkillsLockFileV1 = {
        version: 1,
        library: {
          owner: 'anthropics',
          repo: 'skills',
          ref: 'main',
          path: 'skills'
        },
        installed: {
          'test-skill': {
            sourceSkillPath: 'skills/test-skill',
            installedAt: '2024-01-01T00:00:00.000Z'
          }
        }
      };

      (workspace.fs.readFile as jest.Mock).mockResolvedValue(
        Buffer.from(JSON.stringify(mockLockFile))
      );

      const result = await readLockFile(mockWorkspaceUri as any);

      expect(result).toEqual(mockLockFile);
    });

    it('should return undefined when lock file does not exist', async () => {
      (workspace.fs.readFile as jest.Mock).mockRejectedValue(
        new Error('File not found')
      );

      const result = await readLockFile(mockWorkspaceUri as any);

      expect(result).toBeUndefined();
    });

    it('should return undefined when lock file has invalid version', async () => {
      const invalidLockFile = {
        version: 2,
        library: { owner: 'test', repo: 'test', ref: 'main', path: 'skills' },
        installed: {}
      };

      (workspace.fs.readFile as jest.Mock).mockResolvedValue(
        Buffer.from(JSON.stringify(invalidLockFile))
      );

      const result = await readLockFile(mockWorkspaceUri as any);

      expect(result).toBeUndefined();
    });

    it('should return undefined when lock file has invalid JSON', async () => {
      (workspace.fs.readFile as jest.Mock).mockResolvedValue(
        Buffer.from('invalid json {')
      );

      const result = await readLockFile(mockWorkspaceUri as any);

      expect(result).toBeUndefined();
    });
  });

  describe('writeLockFile', () => {
    const mockLibrary: LibraryConfig = {
      owner: 'anthropics',
      repo: 'skills',
      ref: 'main',
      path: 'skills',
      cacheTtlHours: 24
    };

    it('should create new lock file when none exists', async () => {
      (workspace.fs.readFile as jest.Mock).mockRejectedValue(new Error('Not found'));
      (workspace.fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const beforeTime = new Date().toISOString();
      await writeLockFile(mockWorkspaceUri as any, mockLibrary, [
        { skillName: 'new-skill', sourceSkillPath: 'skills/new-skill' }
      ]);
      const afterTime = new Date().toISOString();

      expect(workspace.fs.writeFile).toHaveBeenCalled();
      const [, writtenBuffer] = (workspace.fs.writeFile as jest.Mock).mock.calls[0];
      const writtenContent = JSON.parse(writtenBuffer.toString());

      expect(writtenContent.version).toBe(1);
      expect(writtenContent.library).toEqual({
        owner: 'anthropics',
        repo: 'skills',
        ref: 'main',
        path: 'skills'
      });
      expect(writtenContent.installed['new-skill'].sourceSkillPath).toBe('skills/new-skill');
      expect(writtenContent.installed['new-skill'].installedAt >= beforeTime).toBe(true);
      expect(writtenContent.installed['new-skill'].installedAt <= afterTime).toBe(true);
    });

    it('should update existing lock file with new skills', async () => {
      const existingLockFile: SkillsLockFileV1 = {
        version: 1,
        library: { owner: 'old', repo: 'repo', ref: 'old', path: 'old' },
        installed: {
          'existing-skill': {
            sourceSkillPath: 'skills/existing',
            installedAt: '2024-01-01T00:00:00.000Z'
          }
        }
      };

      (workspace.fs.readFile as jest.Mock).mockResolvedValue(
        Buffer.from(JSON.stringify(existingLockFile))
      );
      (workspace.fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await writeLockFile(mockWorkspaceUri as any, mockLibrary, [
        { skillName: 'new-skill', sourceSkillPath: 'skills/new-skill' }
      ]);

      const [, writtenBuffer] = (workspace.fs.writeFile as jest.Mock).mock.calls[0];
      const writtenContent = JSON.parse(writtenBuffer.toString());

      // Library should be updated
      expect(writtenContent.library.owner).toBe('anthropics');
      // Existing skill should remain
      expect(writtenContent.installed['existing-skill']).toBeDefined();
      // New skill should be added
      expect(writtenContent.installed['new-skill']).toBeDefined();
    });

    it('should update timestamp when reinstalling same skill', async () => {
      const oldTimestamp = '2024-01-01T00:00:00.000Z';
      const existingLockFile: SkillsLockFileV1 = {
        version: 1,
        library: { owner: 'anthropics', repo: 'skills', ref: 'main', path: 'skills' },
        installed: {
          'test-skill': {
            sourceSkillPath: 'skills/test-skill',
            installedAt: oldTimestamp
          }
        }
      };

      (workspace.fs.readFile as jest.Mock).mockResolvedValue(
        Buffer.from(JSON.stringify(existingLockFile))
      );
      (workspace.fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await writeLockFile(mockWorkspaceUri as any, mockLibrary, [
        { skillName: 'test-skill', sourceSkillPath: 'skills/test-skill' }
      ]);

      const [, writtenBuffer] = (workspace.fs.writeFile as jest.Mock).mock.calls[0];
      const writtenContent = JSON.parse(writtenBuffer.toString());

      expect(writtenContent.installed['test-skill'].installedAt).not.toBe(oldTimestamp);
    });
  });

  describe('removeFromLockFile', () => {
    it('should remove specified skills from lock file', async () => {
      const existingLockFile: SkillsLockFileV1 = {
        version: 1,
        library: { owner: 'anthropics', repo: 'skills', ref: 'main', path: 'skills' },
        installed: {
          'skill-a': { sourceSkillPath: 'skills/a', installedAt: '2024-01-01T00:00:00.000Z' },
          'skill-b': { sourceSkillPath: 'skills/b', installedAt: '2024-01-01T00:00:00.000Z' },
          'skill-c': { sourceSkillPath: 'skills/c', installedAt: '2024-01-01T00:00:00.000Z' }
        }
      };

      (workspace.fs.readFile as jest.Mock).mockResolvedValue(
        Buffer.from(JSON.stringify(existingLockFile))
      );
      (workspace.fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await removeFromLockFile(mockWorkspaceUri as any, ['skill-a', 'skill-c']);

      const [, writtenBuffer] = (workspace.fs.writeFile as jest.Mock).mock.calls[0];
      const writtenContent = JSON.parse(writtenBuffer.toString());

      expect(writtenContent.installed['skill-a']).toBeUndefined();
      expect(writtenContent.installed['skill-b']).toBeDefined();
      expect(writtenContent.installed['skill-c']).toBeUndefined();
    });

    it('should do nothing when lock file does not exist', async () => {
      (workspace.fs.readFile as jest.Mock).mockRejectedValue(new Error('Not found'));

      await removeFromLockFile(mockWorkspaceUri as any, ['skill-a']);

      expect(workspace.fs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle removing non-existent skills gracefully', async () => {
      const existingLockFile: SkillsLockFileV1 = {
        version: 1,
        library: { owner: 'anthropics', repo: 'skills', ref: 'main', path: 'skills' },
        installed: {
          'skill-a': { sourceSkillPath: 'skills/a', installedAt: '2024-01-01T00:00:00.000Z' }
        }
      };

      (workspace.fs.readFile as jest.Mock).mockResolvedValue(
        Buffer.from(JSON.stringify(existingLockFile))
      );
      (workspace.fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await removeFromLockFile(mockWorkspaceUri as any, ['non-existent']);

      const [, writtenBuffer] = (workspace.fs.writeFile as jest.Mock).mock.calls[0];
      const writtenContent = JSON.parse(writtenBuffer.toString());

      expect(writtenContent.installed['skill-a']).toBeDefined();
    });
  });
});
