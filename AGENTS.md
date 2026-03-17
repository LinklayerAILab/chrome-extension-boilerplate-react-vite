# Repository Guidelines

## Project Structure & Module Organization
- Monorepo managed by pnpm workspaces and Turborepo. Core extension code lives in `chrome-extension/` (`src/`, `public/`, `utils/`, `manifest.ts` + `vite.config.mts`).
- UI pages are in `pages/` (e.g., `popup/`, `options/`, `side-panel/`, `new-tab/`, `content/`, `devtools/`). Each folder is a Vite entry built into `dist/`.
- Shared packages sit under `packages/`: UI components and Tailwind config (`ui/`, `tailwindcss-config/`), i18n resources (`i18n/`), storage helpers (`storage/`), HMR helpers (`hmr/`), env loader (`env/`), Vite utilities (`vite-config/`), module scaffolding (`module-manager/`), and bundling tools (`zipper/`, `dev-utils/`).
- End-to-end tests use WebdriverIO in `tests/e2e/` (configs, helpers, specs). Generated artifacts live in `dist/` and `.turbo/`. Utility scripts are in `bash-scripts/`.
- Content UI platform injection lives under `pages/content-ui/src/matches/all/components/`; the Settings UI toggles per-platform injection via `usePlatformInjection`.

## Build, Test & Development Commands
- Install deps: `pnpm install --frozen-lockfile` (Node >= 22.15.1, pnpm 10.11.0). Copy envs: `pnpm copy-env`.
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
- PRs should describe the change, link issues, and list manual test steps (e.g., "pnpm dev (Chrome), clicked popup action"). Include before/after screenshots for UI-facing work and note any manifest or permission changes.

## Security & Configuration Tips
- Base env template is `.example.env`; run `pnpm copy-env` then set values locally. Do not commit secrets or production IDs.
- Manifest is generated from `chrome-extension/manifest.ts`; validate permissions and host matches before shipping. Use `pnpm build:firefox` when targeting Firefox to set the correct flags.

## Content UI Injection Notes
- `SettingPanel` controls platform toggles stored in `chrome.storage.local` under `platform_settings`; changes dispatch `platformSettingsChanged` for live updates.
- `PlatformInjectionManager` initializes defaults, subscribes to settings, and wires `usePlatformInjection('x')` to inject or remove the X UI.
- X injection targets `x.com` or `twitter.com`, creates a container `${platform}-platform-injection`, and renders `XPlatformComponent` via `createRoot`.
- Insert position resolution is anchor-based: it first targets `aria-label="Subscribe to Premium"` with `role="complementary"` and inserts before that element's grandparent; if missing, it targets `aria-label="Relevant people"` with `role="complementary"` and inserts before that element's parent; if still missing, it targets `aria-label="Trending"` with `tabindex="0"` and inserts after the second child of the first child in that block.
- Debug logging in `usePlatformInjection`/`injectPlatformComponent` traces selector lookup, target element info, and retry ticks when diagnosing injection placement issues.
- Reinjection is driven by route watchers (pushState/replaceState, popstate, hashchange, DOM mutations) and a container watcher; quick retries run on short intervals after route changes or missing containers.

## Documentation Sync
- Keep `AGENTS.md` updated alongside any changes to structure, tooling, scripts, or workflows; update it in the same change set.
