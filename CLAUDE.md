# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Turborepo-based monorepo for building Chrome/Firefox extensions with React, TypeScript, and Vite. The project uses a modular architecture where each extension page/component is a separate workspace package.

## Essential Commands

### Development
```bash
# Chrome development (with HMR)
pnpm dev

# Firefox development
pnpm dev:firefox

# Production build
pnpm build
pnpm build:firefox

# Create distributable zip
pnpm zip
pnpm zip:firefox
```

### Module Management
```bash
# Interactive CLI to enable/disable extension modules
pnpm module-manager

# Delete specific modules (removes from build and manifest)
pnpm module-manager -d popup content-ui

# Delete all except specified modules
pnpm module-manager -de popup background

# Recover deleted modules
pnpm module-manager -r popup

# Recover all except specified modules
pnpm module-manager -re popup
```

### Code Quality
```bash
# Type checking
pnpm type-check

# Linting
pnpm lint
pnpm lint:fix

# Format code
pnpm format

# Run end-to-end tests
pnpm e2e
```

### Dependency Management
```bash
# Install dependency for root package
pnpm i <package> -w

# Install dependency for specific module
pnpm i <package> -F <module-name>

# Clean all builds, cache, and node_modules
pnpm clean
```

## 严格遵守当前项目的eslint的代码规则
## 严格遵守当前项目的typescript类型约束

## Architecture

### Monorepo Structure

The project uses **Turborepo** with **pnpm workspaces**. Key architectural points:

- **Turborepo** orchestrates builds with dependency management via `dependsOn` in `turbo.json`
- All workspace packages use `workspace:*` for inter-package dependencies
- Build output goes to `dist/` directory in the project root
- Environment variables with `CEB_*` or `CLI_CEB_*` prefix are globally available

### Extension Modules (pages/)

Each extension feature is a separate package in `pages/`:
- `popup` - Extension toolbar popup
- `options` - Settings page
- `new-tab` - New tab page override
- `devtools` + `devtools-panel` - DevTools extension
- `side-panel` - Chrome side panel (114+)
- `content` - Non-UI content scripts (executes JS on web pages)
- `content-ui` - UI content scripts (renders React components on web pages)
- `content-runtime` - Dynamically injectable content scripts

### Core Extension (chrome-extension/)

- **manifest.ts** - Generates `manifest.json` dynamically based on enabled modules
- **src/background/** - Background service worker
- **public/** - Icons and content script CSS

The chrome-extension package is built as an ES module with the background script bundled to `dist/background.js`.

### Shared Packages (packages/)

Key packages for understanding the architecture:

**@extension/hmr** - Custom Hot Module Reload system
- WebSocket server on port 8081 for development
- Three message types: `BUILD_COMPLETE`, `DO_UPDATE`, `DONE_UPDATE`
- Clients (background, content scripts) connect to WebSocket and reload on build completion
- Plugin: `watchRebuildPlugin` injects HMR client code into builds

**@extension/module-manager** - CLI tool to enable/disable modules
- Compresses and archives deleted modules to `~archive/`
- Automatically updates `manifest.ts` to remove/add manifest entries
- Module configuration stored in `lib/const.ts` - **edit this if you modify content script matches**
- Supports batch operations and interactive mode

**@extension/env** - Environment variable management
- All project env vars must use `CEB_` prefix
- CLI vars use `CLI_CEB_` prefix (e.g., `CLI_CEB_DEV`, `CLI_CEB_FIREFOX`)
- Import constants like `IS_DEV` from `@extension/env`
- Set `CEB_DEV_LOCALE` in `.env` to force specific language during development

**@extension/i18n** - Type-safe internationalization
- Translation files in `packages/i18n/locales/{locale}/messages.json`
- Use `t()` function to translate keys
- Type errors occur if translation keys don't match across all locales
- Supports placeholders: `t('greeting', 'John')`

**@extension/storage** - Chrome Storage API wrapper
- Provides TypeScript-safe storage utilities for `chrome.storage.local` and `chrome.storage.session`

### Build System

**Vite Configuration**:
- Each module has its own Vite config extending `@extension/vite-config`
- Custom plugins: lib-assets handling, manifest generation, public file watching, HMR rebuilds
- Content scripts bundle as IIFE (`.iife.js`)

**Turborepo Tasks** (from `turbo.json`):
- `ready` - Prepares dependencies
- `dev` - Development mode (persistent, depends on `ready`)
- `build` - Production build (depends on `ready` and `^build`)
- All tasks have `cache: false` to ensure fresh builds

**Environment Setup**:
- `bash-scripts/set-global-env.sh` - Sets CLI_CEB_* environment variables
- `bash-scripts/copy_env.sh` - Copies `.env.example` to `.env` if needed
- Run automatically via `pnpm set-global-env` before builds

## Module Manager Workflow

When you use `pnpm module-manager` to disable a module:
1. The module folder is compressed and moved to `~archive/{module-name}.tar.gz`
2. Manifest entries are automatically removed from `chrome-extension/manifest.ts`
3. Module is excluded from Turborepo builds

To recover:
1. Module is extracted from `~archive/`
2. Manifest entries are restored
3. Module is included in builds again

**Important**: If you modify content script matches (e.g., change which URLs a script runs on), update `packages/module-manager/lib/const.ts` in the `MODULE_CONFIG` object. Otherwise, recovery won't restore your custom matches.

## Content Script Architecture

Three types of content scripts:

1. **content** - Pure JavaScript, runs in page context, visible in browser console
2. **content-ui** - React components injected into the page DOM (Shadow DOM), visible at bottom of pages
3. **content-runtime** - Dynamically injectable scripts (e.g., triggered from popup)

Content scripts are bundled as IIFE modules with `.iife.js` extension and referenced in manifest.

## HMR (Hot Module Reload) System

Custom implementation because Chrome extensions can't use standard Vite HMR:

1. HMR server starts on WebSocket port 8081
2. Extension contexts (background, content scripts) connect as WebSocket clients
3. When build completes, server broadcasts `BUILD_COMPLETE` then `DO_UPDATE`
4. Clients receive message and trigger reload/rebuild
5. Clients send `DONE_UPDATE` back to server

If HMR appears frozen, restart dev server. If you get a grpc error, kill turbo processes and restart.

## Cross-Browser Support

- **Chrome**: `pnpm dev` or `pnpm build`
- **Firefox**: `pnpm dev:firefox` or `pnpm build:firefox`

Firefox builds remove Chrome-specific manifest entries automatically. Firefox loads extensions in temporary mode (must reload on each browser start).

## File Conventions

- Use `.mts` extension for TypeScript modules
- Entry points are typically `index.ts` or `index.tsx`
- All workspace packages are `"private": true`
- Inter-package deps use `workspace:*` protocol

## Adding New Features

1. Create new page in `pages/` following existing structure
2. Add to `packages/module-manager/lib/const.ts` DEFAULT_CHOICES and MODULE_CONFIG
3. Update `chrome-extension/manifest.ts` to include the new feature
4. Add module to appropriate workspace packages if needed

## Storage Pattern

The project demonstrates a shared storage pattern using Chrome's storage API. Key files:
- `packages/shared/src/hooks/use-storage.ts` - Custom hook for storage
- `pages/popup/src/components/Popup.tsx` - Example usage with theme storage

Storage state is shared across all extension contexts (popup, options, content scripts, background).
