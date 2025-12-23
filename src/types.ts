export interface LibraryConfig {
  owner: string;
  repo: string;
  ref: string;
  path: string;
  cacheTtlHours: number;
}

export interface SkillSummary {
  /** Skill identifier, taken from SKILL.md frontmatter */
  name: string;
  /** One-line description from frontmatter */
  description: string;
  /** Absolute path on disk to the directory containing SKILL.md (in the extracted repo) */
  absSkillDir: string;
  /** Absolute path on disk to SKILL.md */
  absSkillMd: string;
  /** Repo-relative path to the skill dir (for display/debug) */
  repoRelativeDir: string;
  /** Whether the skill likely contains executable scripts */
  hasScripts: boolean;
  /** Raw SKILL.md text */
  skillMdText: string;
}

export interface SkillsLockFileV1 {
  version: 1;
  library: {
    owner: string;
    repo: string;
    ref: string;
    path: string;
  };
  installed: Record<
    string,
    {
      sourceSkillPath: string;
      installedAt: string;
    }
  >;
}
