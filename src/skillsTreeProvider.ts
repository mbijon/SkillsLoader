import * as vscode from 'vscode';
import { readLockFile } from './lockFile';
import { logInfo, logError } from './log';

/**
 * Tree item representing an installed skill in the sidebar.
 */
export class SkillTreeItem extends vscode.TreeItem {
  constructor(
    public readonly skillName: string,
    public readonly workspaceFolder: vscode.WorkspaceFolder,
    public readonly sourceSkillPath: string,
    public readonly installedAt: string
  ) {
    super(skillName, vscode.TreeItemCollapsibleState.None);

    this.contextValue = 'skill';
    this.description = sourceSkillPath;
    this.tooltip = new vscode.MarkdownString(
      `**${skillName}**\n\n` +
      `Source: \`${sourceSkillPath}\`\n\n` +
      `Installed: ${new Date(installedAt).toLocaleString()}`
    );

    // Set icon
    this.iconPath = new vscode.ThemeIcon('symbol-method');

    // Command to open SKILL.md when clicked
    const skillMdUri = vscode.Uri.joinPath(
      workspaceFolder.uri,
      '.github',
      'skills',
      skillName,
      'SKILL.md'
    );
    this.command = {
      command: 'vscode.open',
      title: 'Open Skill',
      arguments: [skillMdUri]
    };

    this.resourceUri = vscode.Uri.joinPath(
      workspaceFolder.uri,
      '.github',
      'skills',
      skillName
    );
  }
}

/**
 * Tree item representing a workspace folder containing skills.
 */
export class WorkspaceFolderTreeItem extends vscode.TreeItem {
  constructor(
    public readonly workspaceFolder: vscode.WorkspaceFolder,
    public readonly skillCount: number
  ) {
    super(
      workspaceFolder.name,
      skillCount > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None
    );

    this.contextValue = 'workspaceFolder';
    this.description = `${skillCount} skill${skillCount !== 1 ? 's' : ''}`;
    this.iconPath = vscode.ThemeIcon.Folder;
    this.tooltip = `${workspaceFolder.name}: ${skillCount} installed skill${skillCount !== 1 ? 's' : ''}`;
  }
}

type TreeItemType = WorkspaceFolderTreeItem | SkillTreeItem;

/**
 * TreeDataProvider for showing installed skills in the sidebar.
 */
export class SkillsTreeDataProvider implements vscode.TreeDataProvider<TreeItemType> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItemType | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private skillsByWorkspace = new Map<string, SkillTreeItem[]>();

  constructor() {
    // Watch for file system changes in .github/skills directories
    this.setupFileWatcher();
  }

  private setupFileWatcher(): void {
    const watcher = vscode.workspace.createFileSystemWatcher('**/.github/skills/**');
    watcher.onDidCreate(() => this.refresh());
    watcher.onDidDelete(() => this.refresh());
    watcher.onDidChange(() => this.refresh());
  }

  /**
   * Refresh the tree view.
   */
  refresh(): void {
    this.skillsByWorkspace.clear();
    this._onDidChangeTreeData.fire();
    logInfo('Skills tree view refreshed');
  }

  getTreeItem(element: TreeItemType): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItemType): Promise<TreeItemType[]> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return [];
    }

    // Root level: show workspace folders (or skills directly if single folder)
    if (!element) {
      if (folders.length === 1) {
        // Single workspace: show skills directly
        return this.getSkillsForWorkspace(folders[0]);
      } else {
        // Multi-root: show workspace folders
        const items: WorkspaceFolderTreeItem[] = [];
        for (const folder of folders) {
          const skills = await this.getSkillsForWorkspace(folder);
          items.push(new WorkspaceFolderTreeItem(folder, skills.length));
          this.skillsByWorkspace.set(folder.uri.toString(), skills);
        }
        return items;
      }
    }

    // Workspace folder level: show skills
    if (element instanceof WorkspaceFolderTreeItem) {
      const cached = this.skillsByWorkspace.get(element.workspaceFolder.uri.toString());
      if (cached) {
        return cached;
      }
      return this.getSkillsForWorkspace(element.workspaceFolder);
    }

    return [];
  }

  private async getSkillsForWorkspace(folder: vscode.WorkspaceFolder): Promise<SkillTreeItem[]> {
    try {
      const lock = await readLockFile(folder.uri);
      if (!lock || !lock.installed) {
        return [];
      }

      const items: SkillTreeItem[] = [];
      for (const [skillName, info] of Object.entries(lock.installed)) {
        if (info) {
          items.push(new SkillTreeItem(
            skillName,
            folder,
            info.sourceSkillPath,
            info.installedAt
          ));
        }
      }

      // Sort alphabetically
      items.sort((a, b) => a.skillName.localeCompare(b.skillName));
      return items;
    } catch (e) {
      logError('Failed to load skills for workspace', e);
      return [];
    }
  }

  /**
   * Get the skill tree item for a given skill name in a workspace.
   */
  getSkillItem(workspaceFolder: vscode.WorkspaceFolder, skillName: string): SkillTreeItem | undefined {
    const skills = this.skillsByWorkspace.get(workspaceFolder.uri.toString());
    return skills?.find(s => s.skillName === skillName);
  }
}

/**
 * Create and register the skills tree view.
 */
export function createSkillsTreeView(context: vscode.ExtensionContext): {
  treeView: vscode.TreeView<TreeItemType>;
  provider: SkillsTreeDataProvider;
} {
  const provider = new SkillsTreeDataProvider();

  const treeView = vscode.window.createTreeView('skillsImporter.installedSkills', {
    treeDataProvider: provider,
    showCollapseAll: true
  });

  context.subscriptions.push(treeView);

  return { treeView, provider };
}
