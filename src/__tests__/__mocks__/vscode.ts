/**
 * Mock implementation of the vscode module for testing.
 */

export const Uri = {
  file: jest.fn((path: string) => ({
    fsPath: path,
    path: path,
    scheme: 'file',
    toString: () => `file://${path}`
  })),
  joinPath: jest.fn((base: { fsPath: string }, ...pathSegments: string[]) => {
    const fullPath = [base.fsPath, ...pathSegments].join('/');
    return {
      fsPath: fullPath,
      path: fullPath,
      scheme: 'file',
      toString: () => `file://${fullPath}`
    };
  }),
  parse: jest.fn((value: string) => ({
    fsPath: value.replace('file://', ''),
    path: value.replace('file://', ''),
    scheme: 'file',
    toString: () => value
  }))
};

export const FileType = {
  Unknown: 0,
  File: 1,
  Directory: 2,
  SymbolicLink: 64
};

export const TreeItemCollapsibleState = {
  None: 0,
  Collapsed: 1,
  Expanded: 2
};

export class TreeItem {
  label?: string;
  description?: string;
  tooltip?: string | MarkdownString;
  iconPath?: ThemeIcon | { light: string; dark: string };
  command?: { command: string; title: string; arguments?: unknown[] };
  contextValue?: string;
  resourceUri?: typeof Uri;
  collapsibleState?: number;

  constructor(label: string, collapsibleState?: number) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

export class ThemeIcon {
  static readonly File = new ThemeIcon('file');
  static readonly Folder = new ThemeIcon('folder');

  constructor(public readonly id: string) {}
}

export class MarkdownString {
  value: string;
  isTrusted?: boolean;

  constructor(value?: string) {
    this.value = value ?? '';
  }

  appendText(value: string): this {
    this.value += value;
    return this;
  }

  appendMarkdown(value: string): this {
    this.value += value;
    return this;
  }
}

export class EventEmitter<T> {
  private listeners: ((e: T) => void)[] = [];

  event = (listener: (e: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => this.listeners = this.listeners.filter(l => l !== listener) };
  };

  fire(data: T): void {
    this.listeners.forEach(l => l(data));
  }

  dispose(): void {
    this.listeners = [];
  }
}

export class RelativePattern {
  constructor(
    public base: string,
    public pattern: string
  ) {}
}

export const workspace = {
  workspaceFolders: undefined as { uri: ReturnType<typeof Uri.file>; name: string; index: number }[] | undefined,
  getConfiguration: jest.fn(() => ({
    get: jest.fn((key: string, defaultValue?: unknown) => defaultValue)
  })),
  fs: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    stat: jest.fn(),
    readDirectory: jest.fn(),
    createDirectory: jest.fn(),
    delete: jest.fn()
  },
  getWorkspaceFolder: jest.fn(),
  createFileSystemWatcher: jest.fn(() => ({
    onDidCreate: jest.fn(),
    onDidChange: jest.fn(),
    onDidDelete: jest.fn(),
    dispose: jest.fn()
  })),
  openTextDocument: jest.fn(),
  isTrusted: true
};

export const window = {
  showInformationMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  showQuickPick: jest.fn(),
  showTextDocument: jest.fn(),
  withProgress: jest.fn((options, task) => task({ report: jest.fn() }, { isCancellationRequested: false })),
  createOutputChannel: jest.fn(() => ({
    appendLine: jest.fn(),
    append: jest.fn(),
    clear: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn()
  })),
  createStatusBarItem: jest.fn(() => ({
    text: '',
    tooltip: '',
    command: '',
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn()
  })),
  createTreeView: jest.fn(() => ({
    reveal: jest.fn(),
    dispose: jest.fn()
  })),
  activeTextEditor: undefined
};

export const commands = {
  registerCommand: jest.fn(() => ({ dispose: jest.fn() })),
  executeCommand: jest.fn()
};

export const authentication = {
  getSession: jest.fn(),
  onDidChangeSessions: jest.fn(() => ({ dispose: jest.fn() }))
};

export const env = {
  clipboard: {
    writeText: jest.fn(),
    readText: jest.fn()
  }
};

export const ProgressLocation = {
  Notification: 15,
  SourceControl: 1,
  Window: 10
};

export const StatusBarAlignment = {
  Left: 1,
  Right: 2
};

export const ConfigurationTarget = {
  Global: 1,
  Workspace: 2,
  WorkspaceFolder: 3
};

// Default export for compatibility
export default {
  Uri,
  FileType,
  TreeItem,
  TreeItemCollapsibleState,
  ThemeIcon,
  MarkdownString,
  EventEmitter,
  RelativePattern,
  workspace,
  window,
  commands,
  authentication,
  env,
  ProgressLocation,
  StatusBarAlignment,
  ConfigurationTarget
};
