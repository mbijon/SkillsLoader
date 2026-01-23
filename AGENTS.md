# Repository Guidelines

## Project Structure & Module Organization

- `src/`: TypeScript source for the VS Code extension (entry point: `src/extension.ts`).
- `out/`: compiled JavaScript emitted by `tsc` (generated; don’t hand-edit).
- Root config: `package.json`, `package-lock.json`, `tsconfig.json`.
- Runtime behavior: the extension installs skills into a *user workspace* at `.github/skills/` (not this repo).

## Build, Test, and Development Commands

- `npm install`: install dependencies (use `npm ci` in CI or for repeatable installs).
- `npm run compile`: compile `src/` → `out/` (also runs on `vscode:prepublish`).
- `npm run watch`: compile in watch mode while developing.
- `npm run lint`: run ESLint over the repo.
- `npm run package`: build a `.vsix` with `@vscode/vsce` (outputs `skills-importer-<version>.vsix` by default).
- `npm test`: currently a placeholder (`No tests yet`).
- Local run: open in VS Code and press `F5` to launch an Extension Development Host.

## Coding Style & Naming Conventions

- TypeScript with `strict` enabled (avoid `any`; prefer precise types in `src/types.ts`).
- Match existing formatting: 2-space indentation, single quotes, semicolons.
- Naming: `camelCase` (vars/functions), `PascalCase` (types/classes), `SCREAMING_SNAKE_CASE` (constants).
- Keep generated artifacts out of review: don’t include changes to `out/` unless the workflow explicitly requires it.

## Testing Guidelines

- There is no test harness yet. If you add tests, prefer a VS Code extension test setup and wire it into `npm test`.
- Name tests after the unit under test (e.g., `skillsCatalog.test.ts`) and keep fixtures minimal.

## Commit & Pull Request Guidelines

- Current history uses short, descriptive subjects (e.g., “Initial commit”). Keep subjects imperative and ≤72 chars.
- PRs should include: what changed, why, how to verify (commands + manual steps in VS Code), and any settings/UX changes.

## Security & Configuration Tips

- This extension downloads and extracts skill repositories; keep the “scripts present” warning and restricted-workspace checks intact.
- Avoid introducing execution of downloaded content; treat skills as data to copy, not code to run.
