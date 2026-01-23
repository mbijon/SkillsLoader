import * as fs from 'fs';
import * as path from 'path';
import { loadSkillsFromRepo } from '../skillsCatalog';

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  promises: {
    readdir: jest.fn(),
    readFile: jest.fn(),
    stat: jest.fn()
  }
}));

describe('skillsCatalog', () => {
  const mockRepoRoot = '/tmp/test-repo';
  const mockSkillsPath = 'skills';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadSkillsFromRepo', () => {
    it('should throw error when skills root path does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(loadSkillsFromRepo(mockRepoRoot, mockSkillsPath))
        .rejects.toThrow('Skills root path does not exist in repo: skills');
    });

    it('should return empty array when no SKILL.md files found', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.promises.readdir as jest.Mock).mockResolvedValue([]);

      const result = await loadSkillsFromRepo(mockRepoRoot, mockSkillsPath);

      expect(result).toEqual([]);
    });

    it('should parse valid SKILL.md with frontmatter', async () => {
      const skillMdContent = `---
name: test-skill
description: A test skill for testing
---
# Test Skill

This is a test skill.
`;

      (fs.existsSync as jest.Mock).mockImplementation((p: string) => {
        if (p === path.join(mockRepoRoot, mockSkillsPath)) {
          return true;
        }
        if (p === path.join(mockRepoRoot, mockSkillsPath, 'test-skill', 'scripts')) {
          return false;
        }
        return false;
      });

      (fs.promises.readdir as jest.Mock).mockImplementation(async (dir: string, _opts?: { withFileTypes: boolean }) => {
        if (dir === path.join(mockRepoRoot, mockSkillsPath)) {
          return [{
            name: 'test-skill',
            isDirectory: () => true,
            isFile: () => false
          }];
        }
        if (dir === path.join(mockRepoRoot, mockSkillsPath, 'test-skill')) {
          return [{
            name: 'SKILL.md',
            isDirectory: () => false,
            isFile: () => true
          }];
        }
        return [];
      });

      (fs.promises.readFile as jest.Mock).mockResolvedValue(skillMdContent);
      (fs.promises.stat as jest.Mock).mockRejectedValue(new Error('Not found'));

      const result = await loadSkillsFromRepo(mockRepoRoot, mockSkillsPath);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('test-skill');
      expect(result[0].description).toBe('A test skill for testing');
      expect(result[0].hasScripts).toBe(false);
    });

    it('should skip SKILL.md without required frontmatter fields', async () => {
      const invalidSkillMd = `---
name: only-name
---
# No description
`;

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.promises.readdir as jest.Mock).mockImplementation(async (dir: string) => {
        if (dir === path.join(mockRepoRoot, mockSkillsPath)) {
          return [{
            name: 'invalid-skill',
            isDirectory: () => true,
            isFile: () => false
          }];
        }
        if (dir === path.join(mockRepoRoot, mockSkillsPath, 'invalid-skill')) {
          return [{
            name: 'SKILL.md',
            isDirectory: () => false,
            isFile: () => true
          }];
        }
        return [];
      });

      (fs.promises.readFile as jest.Mock).mockResolvedValue(invalidSkillMd);

      const result = await loadSkillsFromRepo(mockRepoRoot, mockSkillsPath);

      expect(result).toHaveLength(0);
    });

    it('should detect scripts in skill directory', async () => {
      const skillMdContent = `---
name: script-skill
description: A skill with scripts
---
# Script Skill
`;

      (fs.existsSync as jest.Mock).mockImplementation((p: string) => {
        if (p === path.join(mockRepoRoot, mockSkillsPath)) {
          return true;
        }
        if (p === path.join(mockRepoRoot, mockSkillsPath, 'script-skill', 'scripts')) {
          return true;
        }
        return false;
      });

      (fs.promises.readdir as jest.Mock).mockImplementation(async (dir: string) => {
        if (dir === path.join(mockRepoRoot, mockSkillsPath)) {
          return [{
            name: 'script-skill',
            isDirectory: () => true,
            isFile: () => false
          }];
        }
        if (dir === path.join(mockRepoRoot, mockSkillsPath, 'script-skill')) {
          return [
            { name: 'SKILL.md', isDirectory: () => false, isFile: () => true },
            { name: 'scripts', isDirectory: () => true, isFile: () => false }
          ];
        }
        return [];
      });

      (fs.promises.readFile as jest.Mock).mockResolvedValue(skillMdContent);
      (fs.promises.stat as jest.Mock).mockResolvedValue({ isDirectory: () => true });

      const result = await loadSkillsFromRepo(mockRepoRoot, mockSkillsPath);

      expect(result).toHaveLength(1);
      expect(result[0].hasScripts).toBe(true);
    });

    it('should detect script files by extension', async () => {
      const skillMdContent = `---
name: script-file-skill
description: A skill with script files
---
# Script File Skill
`;

      (fs.existsSync as jest.Mock).mockImplementation((p: string) => {
        return p === path.join(mockRepoRoot, mockSkillsPath);
      });

      (fs.promises.readdir as jest.Mock).mockImplementation(async (dir: string) => {
        if (dir === path.join(mockRepoRoot, mockSkillsPath)) {
          return [{
            name: 'script-file-skill',
            isDirectory: () => true,
            isFile: () => false
          }];
        }
        if (dir === path.join(mockRepoRoot, mockSkillsPath, 'script-file-skill')) {
          return [
            { name: 'SKILL.md', isDirectory: () => false, isFile: () => true },
            { name: 'setup.sh', isDirectory: () => false, isFile: () => true }
          ];
        }
        return [];
      });

      (fs.promises.readFile as jest.Mock).mockResolvedValue(skillMdContent);

      const result = await loadSkillsFromRepo(mockRepoRoot, mockSkillsPath);

      expect(result).toHaveLength(1);
      expect(result[0].hasScripts).toBe(true);
    });

    it('should sort skills alphabetically by name', async () => {
      const createSkillMd = (name: string) => `---
name: ${name}
description: Description for ${name}
---
`;

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.promises.readdir as jest.Mock).mockImplementation(async (dir: string) => {
        if (dir === path.join(mockRepoRoot, mockSkillsPath)) {
          return [
            { name: 'zebra-skill', isDirectory: () => true, isFile: () => false },
            { name: 'alpha-skill', isDirectory: () => true, isFile: () => false },
            { name: 'middle-skill', isDirectory: () => true, isFile: () => false }
          ];
        }
        // Return SKILL.md for each skill directory
        return [{ name: 'SKILL.md', isDirectory: () => false, isFile: () => true }];
      });

      (fs.promises.readFile as jest.Mock).mockImplementation(async (filePath: string) => {
        const skillName = path.basename(path.dirname(filePath));
        return createSkillMd(skillName);
      });

      const result = await loadSkillsFromRepo(mockRepoRoot, mockSkillsPath);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('alpha-skill');
      expect(result[1].name).toBe('middle-skill');
      expect(result[2].name).toBe('zebra-skill');
    });

    it('should skip directories named .git and node_modules', async () => {
      const skillMdContent = `---
name: valid-skill
description: A valid skill
---
`;

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.promises.readdir as jest.Mock).mockImplementation(async (dir: string) => {
        if (dir === path.join(mockRepoRoot, mockSkillsPath)) {
          return [
            { name: '.git', isDirectory: () => true, isFile: () => false },
            { name: 'node_modules', isDirectory: () => true, isFile: () => false },
            { name: '.vscode', isDirectory: () => true, isFile: () => false },
            { name: 'valid-skill', isDirectory: () => true, isFile: () => false }
          ];
        }
        if (dir === path.join(mockRepoRoot, mockSkillsPath, 'valid-skill')) {
          return [{ name: 'SKILL.md', isDirectory: () => false, isFile: () => true }];
        }
        return [];
      });

      (fs.promises.readFile as jest.Mock).mockResolvedValue(skillMdContent);

      const result = await loadSkillsFromRepo(mockRepoRoot, mockSkillsPath);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('valid-skill');
    });

    it('should handle invalid YAML frontmatter gracefully', async () => {
      const invalidYamlContent = `---
name: [invalid yaml
---
`;

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.promises.readdir as jest.Mock).mockImplementation(async (dir: string) => {
        if (dir === path.join(mockRepoRoot, mockSkillsPath)) {
          return [{ name: 'bad-skill', isDirectory: () => true, isFile: () => false }];
        }
        return [{ name: 'SKILL.md', isDirectory: () => false, isFile: () => true }];
      });

      (fs.promises.readFile as jest.Mock).mockResolvedValue(invalidYamlContent);

      const result = await loadSkillsFromRepo(mockRepoRoot, mockSkillsPath);

      expect(result).toHaveLength(0);
    });

    it('should trim whitespace from name and description', async () => {
      const skillMdContent = `---
name: "  spaced-skill  "
description: "  A skill with spaces  "
---
`;

      (fs.existsSync as jest.Mock).mockImplementation((p: string) => {
        return p === path.join(mockRepoRoot, mockSkillsPath);
      });

      (fs.promises.readdir as jest.Mock).mockImplementation(async (dir: string) => {
        if (dir === path.join(mockRepoRoot, mockSkillsPath)) {
          return [{ name: 'spaced', isDirectory: () => true, isFile: () => false }];
        }
        return [{ name: 'SKILL.md', isDirectory: () => false, isFile: () => true }];
      });

      (fs.promises.readFile as jest.Mock).mockResolvedValue(skillMdContent);

      const result = await loadSkillsFromRepo(mockRepoRoot, mockSkillsPath);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('spaced-skill');
      expect(result[0].description).toBe('A skill with spaces');
    });
  });
});
