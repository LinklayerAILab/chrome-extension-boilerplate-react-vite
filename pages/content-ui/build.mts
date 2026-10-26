import { existsSync, readFileSync } from 'node:fs';
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

// 构建 Content Scripts（顺序执行，避免 Tailwind CLI 共享状态导致输出不一致）
const buildContentScripts = async () => {
  console.log('[Build] Starting build for', contentScriptConfigs.length, 'scripts');
  for (const { name, config } of contentScriptConfigs) {
    console.log('[Build] Building:', name);
    const folder = resolve(matchesDir, name);
    const tailwindArgs = {
      ['--input']: resolve(folder, 'index.css'),
      ['--output']: resolve(rootDir, 'dist', name, 'index.css'),
      ['--config']: resolve(rootDir, 'tailwind.config.ts'),
    };
    console.log('[Build] Tailwind args:', tailwindArgs);

    // 必须先做一次一次性构建：入口用 `import css?inline`，CSS 不存在时 vite 打包会直接失败。
    await buildTW({ ...tailwindArgs, ['--watch']: false });

    if (IS_DEV) {
      // 不能 await 带 watch 的 buildTW：tailwind 的 processor.watch() 返回一个永不 resolve 的
      // Promise，await 会让后面的 vite build 永远执行不到（这正是 dev 模式下
      // dist/content-ui/all.iife.js 一直缺失的根因）。
      // 这里只启动、不等待：tailwind 在后台持续重写 index.css，vite 自身的 watcher
      // 监听到该文件变化后会重新打包，热更新链路依然完整。
      void buildTW({ ...tailwindArgs, ['--watch']: 'always' });
    }

    //@ts-expect-error This is hidden property into vite's resolveConfig()
    config.configFile = false;
    await build(config);
    console.log('[Build] Completed:', name);
  }
  console.log('[Build] All builds completed');
};

await buildContentScripts();
