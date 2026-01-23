import { workspace, window } from 'vscode';
import { pickWorkspaceFolder } from '../workspace';

jest.mock('vscode');

describe('workspace', () => {
  const createMockFolder = (name: string, path: string) => ({
    uri: { fsPath: path, path, scheme: 'file' },
    name,
    index: 0
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, 'activeTextEditor', { value: undefined, configurable: true });
  });

  describe('pickWorkspaceFolder', () => {
    it('should show error and return undefined when no workspace folders', async () => {
      Object.defineProperty(workspace, 'workspaceFolders', { value: undefined, configurable: true });

      const result = await pickWorkspaceFolder();

      expect(result).toBeUndefined();
      expect(window.showErrorMessage).toHaveBeenCalledWith(
        'No workspace folder is open. Open a folder first.'
      );
    });

    it('should show error and return undefined when workspace folders array is empty', async () => {
      Object.defineProperty(workspace, 'workspaceFolders', { value: [], configurable: true });

      const result = await pickWorkspaceFolder();

      expect(result).toBeUndefined();
      expect(window.showErrorMessage).toHaveBeenCalledWith(
        'No workspace folder is open. Open a folder first.'
      );
    });

    it('should return single folder directly without prompting', async () => {
      const mockFolder = createMockFolder('project', '/workspace/project');
      Object.defineProperty(workspace, 'workspaceFolders', { value: [mockFolder], configurable: true });

      const result = await pickWorkspaceFolder();

      expect(result).toEqual(mockFolder);
      expect(window.showQuickPick).not.toHaveBeenCalled();
    });

    it('should prefer folder containing active editor', async () => {
      const folder1 = createMockFolder('project1', '/workspace/project1');
      const folder2 = createMockFolder('project2', '/workspace/project2');
      Object.defineProperty(workspace, 'workspaceFolders', { value: [folder1, folder2], configurable: true });

      const mockActiveUri = { fsPath: '/workspace/project2/file.ts', scheme: 'file' };
      Object.defineProperty(window, 'activeTextEditor', {
        value: { document: { uri: mockActiveUri } },
        configurable: true
      });
      (workspace.getWorkspaceFolder as jest.Mock).mockReturnValue(folder2);

      const result = await pickWorkspaceFolder();

      expect(result).toEqual(folder2);
      expect(window.showQuickPick).not.toHaveBeenCalled();
    });

    it('should show picker when multiple folders and no active editor', async () => {
      const folder1 = createMockFolder('project1', '/workspace/project1');
      const folder2 = createMockFolder('project2', '/workspace/project2');
      Object.defineProperty(workspace, 'workspaceFolders', { value: [folder1, folder2], configurable: true });

      (window.showQuickPick as jest.Mock).mockResolvedValue({
        label: 'project1',
        description: '/workspace/project1',
        folder: folder1
      });

      const result = await pickWorkspaceFolder();

      expect(result).toEqual(folder1);
      expect(window.showQuickPick).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ label: 'project1', folder: folder1 }),
          expect.objectContaining({ label: 'project2', folder: folder2 })
        ]),
        expect.objectContaining({
          title: 'Select a workspace folder to install the skill into',
          placeHolder: 'Choose workspace folder'
        })
      );
    });

    it('should show picker when active editor file is not in any workspace folder', async () => {
      const folder1 = createMockFolder('project1', '/workspace/project1');
      const folder2 = createMockFolder('project2', '/workspace/project2');
      Object.defineProperty(workspace, 'workspaceFolders', { value: [folder1, folder2], configurable: true });

      const mockActiveUri = { fsPath: '/other/path/file.ts', scheme: 'file' };
      Object.defineProperty(window, 'activeTextEditor', {
        value: { document: { uri: mockActiveUri } },
        configurable: true
      });
      (workspace.getWorkspaceFolder as jest.Mock).mockReturnValue(undefined);

      (window.showQuickPick as jest.Mock).mockResolvedValue({
        label: 'project2',
        description: '/workspace/project2',
        folder: folder2
      });

      const result = await pickWorkspaceFolder();

      expect(result).toEqual(folder2);
      expect(window.showQuickPick).toHaveBeenCalled();
    });

    it('should return undefined when user cancels picker', async () => {
      const folder1 = createMockFolder('project1', '/workspace/project1');
      const folder2 = createMockFolder('project2', '/workspace/project2');
      Object.defineProperty(workspace, 'workspaceFolders', { value: [folder1, folder2], configurable: true });

      (window.showQuickPick as jest.Mock).mockResolvedValue(undefined);

      const result = await pickWorkspaceFolder();

      expect(result).toBeUndefined();
    });
  });
});
