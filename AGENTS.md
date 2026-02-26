# Repository Guidelines

## Project Structure & Module Organization
- Monorepo managed by pnpm workspaces and Turborepo. Core extension code lives in `chrome-extension/` (`src/`, `public/`, `utils/`, `manifest.ts` + `vite.config.mts`).
- UI pages are in `pages/` (e.g., `popup/`, `options/`, `side-panel/`, `new-tab/`, `content/`, `devtools/`). Each folder is a Vite entry built into `dist/`.
- Shared packages sit under `packages/`: UI components and Tailwind config (`ui/`, `tailwindcss-config/`), i18n resources (`i18n/`), storage helpers (`storage/`), HMR helpers (`hmr/`), env loader (`env/`), Vite utilities (`vite-config/`), module scaffolding (`module-manager/`), and bundling tools (`zipper/`, `dev-utils/`).
- End-to-end tests use WebdriverIO in `tests/e2e/` (configs, helpers, specs). Generated artifacts live in `dist/` and `.turbo/`. Utility scripts are in `bash-scripts/`.

## Build, Test & Development Commands
- Install deps: `pnpm install --frozen-lockfile` (Node ≥22.15, pnpm 10). Copy envs: `pnpm copy-env`.
- Dev builds: `pnpm dev` (Chrome), `pnpm dev:firefox` (sets `CLI_CEB_FIREFOX`).
- Production builds: `pnpm build` or `pnpm build:firefox`; outputs to `dist/`.
- Package zip: `pnpm zip` or `pnpm zip:firefox` (uses `packages/zipper`).
- Quality: `pnpm lint`, `pnpm lint:fix`, `pnpm type-check`, `pnpm format`.
- E2E: `pnpm e2e` (runs `zip` then WebdriverIO via Turbo). Clean artifacts: `pnpm clean`.

## Coding Style & Naming Conventions
- TypeScript + React functional components. Prefer hooks and composition over classes.
- Prettier enforces 2-space indent, 120-char width, semicolons, single quotes, trailing commas; Tailwind classes auto-sorted (see `.prettierrc`).
- ESLint extends TS, React, JSX a11y, import rules, and Prettier. React in-JSX scope is off; prefer `const` and arrow functions (`eslint.config.ts`).
- Naming: PascalCase components (`MyPanel.tsx`), camelCase functions/variables, kebab-case asset files. Keep page-specific code within its folder; cross-page utilities go to `packages/shared` or `packages/ui`.

## Testing Guidelines
- WebdriverIO specs live in `tests/e2e/specs/` (Mocha style). Use descriptive `*.spec.ts` names tied to the user flow.
- Run `pnpm e2e` after building/zip; ensure browser has extension loaded from the fresh `dist/`.
- Add helper utilities under `tests/e2e/helpers/`; share fixtures via `tests/e2e/utils/`.

## Commit & Pull Request Guidelines
- Follow conventional commits seen in history: `feat:`, `fix:`, `chore:`, `build(deps):`, `release x.y.z`, optional scopes (`build(deps-dev): bump vite ...`).
- PRs should describe the change, link issues, and list manual test steps (e.g., “pnpm dev (Chrome), clicked popup action”). Include before/after screenshots for UI-facing work and note any manifest or permission changes.

## Security & Configuration Tips
- Base env template is `.example.env`; run `pnpm copy-env` then set values locally. Do not commit secrets or production IDs.
- Manifest is generated from `chrome-extension/manifest.ts`; validate permissions and host matches before shipping. Use `pnpm build:firefox` when targeting Firefox to set the correct flags.
