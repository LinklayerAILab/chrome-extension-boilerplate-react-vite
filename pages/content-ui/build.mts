import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { makeEntryPointPlugin } from '@extension/hmr';
import { getContentScriptEntries, withPageConfig } from '@extension/vite-config';
import { IS_DEV } from '@extension/env';
import { build } from 'vite';
import { build as buildTW } from 'tailwindcss/lib/cli/build';

const rootDir = resolve(import.meta.dirname);
const srcDir = resolve(rootDir, 'src');
const matchesDir = resolve(srcDir, 'matches');

// 读取环境变量
const envPath = resolve(rootDir, '..', '..', '.env');
let whitelistDomains = '';
if (existsSync(envPath)) {
  try {
    const envContent = readFileSync(envPath, 'utf8');
    const envLines = envContent.replace(/\r\n/g, '\n').split('\n');
    for (const line of envLines) {
      const parts = line.split('=');
      if (parts[0] === 'CEB_CONTENT_UI_WHITELIST') {
        whitelistDomains = parts.slice(1).join('=') || '';
        break;
      }
    }
  } catch (e) {
    // Ignore parsing errors
  }
}

console.log('[Build] Content UI whitelist:', whitelistDomains || '(empty - all domains allowed)');

// Content Scripts 构建
const allEntries = getContentScriptEntries(matchesDir);
console.log('[Build] All content script entries:', Object.keys(allEntries));
console.log('[Build] Matches directory:', matchesDir);

const contentScriptConfigs = Object.entries(allEntries).map(([name, entry]) => ({
  name,
  config: withPageConfig({
    mode: IS_DEV ? 'development' : undefined,
    define: {
      // 直接注入白名单值到构建产物中
      'process.env.CEB_CONTENT_UI_WHITELIST': JSON.stringify(whitelistDomains),
    },
    resolve: {
      alias: {
        '@src': srcDir,
      },
    },
    publicDir: resolve(rootDir, 'public'),
    plugins: [IS_DEV && makeEntryPointPlugin()],
    build: {
      emptyOutDir: false, // 防止清空输出目录，避免删除其他 entry 的构建产物
      lib: {
        name: name,
        formats: ['iife'],
        entry,
        fileName: name,
      },
      outDir: resolve(rootDir, '..', '..', 'dist', 'content-ui'),
    },
  }),
}));

// 复制 wallet.html 和 wallet.js 到 dist 目录
const copyWalletFiles = async () => {
  const files = ['wallet.html', 'wallet.js'];
  const publicDir = resolve(rootDir, 'public');
  const targetDir = resolve(rootDir, '..', '..', 'dist', 'content-ui');

  for (const file of files) {
    const sourcePath = resolve(publicDir, file);
    const targetPath = resolve(targetDir, file);

    if (existsSync(sourcePath)) {
      copyFileSync(sourcePath, targetPath);
      console.log(`[Build] ${file} copied to dist/content-ui/`);
    } else {
      console.warn(`[Build] ${file} not found in public directory`);
    }
  }
};

// 构建 Content Scripts（顺序执行，避免 Tailwind CLI 共享状态导致输出不一致）
const buildContentScripts = async () => {
  console.log('[Build] Starting build for', contentScriptConfigs.length, 'scripts');
  for (const { name, config } of contentScriptConfigs) {
    console.log('[Build] Building:', name);
    const folder = resolve(matchesDir, name);
    const args = {
      ['--input']: resolve(folder, 'index.css'),
      ['--output']: resolve(rootDir, 'dist', name, 'index.css'),
      ['--config']: resolve(rootDir, 'tailwind.config.ts'),
      ['--watch']: IS_DEV,
    };
    console.log('[Build] Tailwind args:', args);
    await buildTW(args);
    //@ts-expect-error This is hidden property into vite's resolveConfig()
    config.configFile = false;
    await build(config);
    console.log('[Build] Completed:', name);
  }
  console.log('[Build] All builds completed');
};

// 并行构建所有
await Promise.all([buildContentScripts(), copyWalletFiles()]);
