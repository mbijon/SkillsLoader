# Skills Importer (VS Code Extension)

This extension installs **Agent Skills** from a GitHub repository into your current workspace at:

```
.github/skills/
```

## Commands

- **Skills: Install from Library…**

  - Downloads the configured GitHub skills repo (defaults to `anthropics/skills`)
  - Lets you pick a skill
  - Previews its `SKILL.md`
  - Installs the full skill folder into `.github/skills/<skill-name>/`

- **Skills: Update Installed Skills…**

  - Re-installs skills listed in `.github/skills/.skills-lock.json` from the configured repo/ref

- **Skills: Remove Installed Skill…**
  - Removes selected skill folders from `.github/skills/`

## Settings

- `skillsImporter.library` (default: `anthropics/skills`)
- `skillsImporter.ref` (default: `main`)
- `skillsImporter.path` (default: `skills`)
- `skillsImporter.cache.ttlHours` (default: `24`)

## To Install via VSIX

1. Build or download the VSIX (run `npm run package`; it outputs `skills-importer-<version>.vsix` at the repo root by default).
1. In VS Code, open the Command Palette and run Extensions: Install from VSIX..., then pick the VSIX file.
1. Alternatively, install from a terminal: `code --install-extension /path/to/skills-importer-x.x.x.vsix`
1. Reload the window if prompted and activate in the command palette.

## Development

- Install dependencies: `npm install`
- Build the extension: `npm run compile`
  - Press `F5` in VS Code to launch an Extension Development Host.
- Run the test suite (after compiling): `npm test`
- Watch for rebuilds during development: `npm run watch`
- Package a new VSIX: `npm run package`

---

License: MIT

Copyright: © Mike Bijon @mbijon, 2025
