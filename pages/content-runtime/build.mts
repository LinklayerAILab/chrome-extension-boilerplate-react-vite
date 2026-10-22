import { resolve } from 'node:path';
import { makeEntryPointPlugin } from '@extension/hmr';
import { getContentScriptEntries, withPageConfig } from '@extension/vite-config';
import { IS_DEV } from '@extension/env';
import { build } from 'vite';
import { build as buildTW } from 'tailwindcss/lib/cli/build';

const rootDir = resolve(import.meta.dirname);
const srcDir = resolve(rootDir, 'src');
const matchesDir = resolve(srcDir, 'matches');

const configs = Object.entries(getContentScriptEntries(matchesDir)).map(([name, entry]) => ({
  name,
  config: withPageConfig({
    mode: IS_DEV ? 'development' : undefined,
    resolve: {
      alias: {
        '@src': srcDir,
      },
    },
    publicDir: resolve(rootDir, 'public'),
    plugins: [IS_DEV && makeEntryPointPlugin()],
    build: {
      lib: {
        name: name,
        formats: ['iife'],
        entry,
        fileName: name,
      },
      outDir: resolve(rootDir, '..', '..', 'dist', 'content-runtime'),
    },
  }),
}));

const builds = configs.map(async ({ name, config }) => {
  const folder = resolve(matchesDir, name);
  const args = {
    ['--input']: resolve(folder, 'index.css'),
    ['--output']: resolve(rootDir, 'dist', name, 'index.css'),
    ['--config']: resolve(rootDir, 'tailwind.config.ts'),
    // 'always' 禁用 Tailwind 的 stdin-end 自杀（非 TTY 环境下布尔 true 会让进程直接 exit(0)）
    ['--watch']: IS_DEV ? 'always' : false,
  };
  await buildTW(args);
  //@ts-expect-error This is hidden property into vite's resolveConfig()
  config.configFile = false;
  await build(config);
});

await Promise.all(builds);
