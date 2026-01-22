import { workspace } from 'vscode';
import { getLibraryConfig } from '../config';

jest.mock('vscode');

describe('config', () => {
  describe('getLibraryConfig', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return default config when no settings are configured', () => {
      const mockGet = jest.fn((key: string, defaultValue: unknown) => defaultValue);
      (workspace.getConfiguration as jest.Mock).mockReturnValue({ get: mockGet });

      const config = getLibraryConfig();

      expect(config).toEqual({
        owner: 'anthropics',
        repo: 'skills',
        ref: 'main',
        path: 'skills',
        cacheTtlHours: 24
      });
      expect(workspace.getConfiguration).toHaveBeenCalledWith('skillsImporter');
    });

    it('should return custom config when settings are configured', () => {
      const mockGet = jest.fn((key: string, defaultValue: unknown) => {
        const values: Record<string, unknown> = {
          'library': 'myorg/myskills',
          'ref': 'develop',
          'path': 'custom/skills',
          'cache.ttlHours': 48
        };
        return values[key] ?? defaultValue;
      });
      (workspace.getConfiguration as jest.Mock).mockReturnValue({ get: mockGet });

      const config = getLibraryConfig();

      expect(config).toEqual({
        owner: 'myorg',
        repo: 'myskills',
        ref: 'develop',
        path: 'custom/skills',
        cacheTtlHours: 48
      });
    });

    it('should throw error for invalid library format (no slash)', () => {
      const mockGet = jest.fn((key: string, defaultValue: unknown) => {
        if (key === 'library') {
          return 'invalidformat';
        }
        return defaultValue;
      });
      (workspace.getConfiguration as jest.Mock).mockReturnValue({ get: mockGet });

      expect(() => getLibraryConfig()).toThrow(
        "Invalid skillsImporter.library value: 'invalidformat'. Expected 'owner/repo'."
      );
    });

    it('should throw error for invalid library format (empty owner)', () => {
      const mockGet = jest.fn((key: string, defaultValue: unknown) => {
        if (key === 'library') {
          return '/repo';
        }
        return defaultValue;
      });
      (workspace.getConfiguration as jest.Mock).mockReturnValue({ get: mockGet });

      expect(() => getLibraryConfig()).toThrow(
        "Invalid skillsImporter.library value: '/repo'. Expected 'owner/repo'."
      );
    });

    it('should throw error for invalid library format (empty repo)', () => {
      const mockGet = jest.fn((key: string, defaultValue: unknown) => {
        if (key === 'library') {
          return 'owner/';
        }
        return defaultValue;
      });
      (workspace.getConfiguration as jest.Mock).mockReturnValue({ get: mockGet });

      expect(() => getLibraryConfig()).toThrow(
        "Invalid skillsImporter.library value: 'owner/'. Expected 'owner/repo'."
      );
    });

    it('should handle library with multiple slashes', () => {
      const mockGet = jest.fn((key: string, defaultValue: unknown) => {
        if (key === 'library') {
          return 'owner/repo/extra';
        }
        return defaultValue;
      });
      (workspace.getConfiguration as jest.Mock).mockReturnValue({ get: mockGet });

      const config = getLibraryConfig();

      // Only takes first two parts
      expect(config.owner).toBe('owner');
      expect(config.repo).toBe('repo');
    });

    it('should use zero cache TTL when configured', () => {
      const mockGet = jest.fn((key: string, defaultValue: unknown) => {
        if (key === 'cache.ttlHours') {
          return 0;
        }
        return defaultValue;
      });
      (workspace.getConfiguration as jest.Mock).mockReturnValue({ get: mockGet });

      const config = getLibraryConfig();

      expect(config.cacheTtlHours).toBe(0);
    });
  });
});
