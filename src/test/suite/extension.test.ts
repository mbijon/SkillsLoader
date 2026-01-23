import * as assert from 'assert';

import * as vscode from 'vscode';

suite('Skills Importer Extension', () => {
  test('activates and registers commands', async () => {
    const extension = vscode.extensions.getExtension('local-dev.skills-importer');
    assert.ok(extension, 'Expected extension to be available in test host');

    await extension.activate();

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('skillsImporter.installFromLibrary'));
    assert.ok(commands.includes('skillsImporter.updateInstalledSkills'));
    assert.ok(commands.includes('skillsImporter.removeInstalledSkill'));
  });
});
