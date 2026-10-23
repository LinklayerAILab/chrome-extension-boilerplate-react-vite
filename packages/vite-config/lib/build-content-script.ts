import { withPageConfig } from './index.js';
import { IS_DEV } from '@extension/env';
import { makeEntryPointPlugin } from '@extension/hmr';
import { build as buildTW } from 'tailwindcss/lib/cli/build';
import { build } from 'vite';
import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

interface IContentBuilderProps {
  matchesDir: string;
  srcDir: string;
  rootDir: string;
  contentName: 'content' | 'content-ui' | 'content-runtime';
  withTw: boolean;
}

type BuilderPropsType = Omit<IContentBuilderProps, 'withTw'>;

const getContentScriptEntries = (matchesDir: string) => {
  const entryPoints: Record<string, string> = {};
  const entries = readdirSync(matchesDir);

  entries.forEach((folder: string) => {
    const filePath = resolve(matchesDir, folder);
    const isFolder = statSync(filePath).isDirectory();
    const haveIndexTsFile = readdirSync(filePath).includes('config.ts');
    const haveIndexTsxFile = readdirSync(filePath).includes('index.tsx');

    if (isFolder && !(haveIndexTsFile || haveIndexTsxFile)) {
      throw new Error(`${folder} in \`matches\` doesn't have index.ts or index.tsx file`);
    } else {
      entryPoints[folder] = resolve(filePath, haveIndexTsFile ? 'config.ts' : 'index.tsx');
    }
  });

  return entryPoints;
};

const configsBuilder = ({ matchesDir, srcDir, rootDir, contentName }: BuilderPropsType) =>
  Object.entries(getContentScriptEntries(matchesDir)).map(([name, entry]) => ({
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
        outDir: resolve(rootDir, '..', '..', 'dist', contentName),
      },
    }),
  }));

const builds = async ({ srcDir, contentName, rootDir, matchesDir, withTw }: IContentBuilderProps) =>
  configsBuilder({ matchesDir, srcDir, rootDir, contentName }).map(async ({ name, config }) => {
    if (withTw) {
      const folder = resolve(matchesDir, name);
      const tailwindArgs = {
        ['--input']: resolve(folder, 'index.css'),
        ['--output']: resolve(rootDir, 'dist', name, 'index.css'),
        ['--config']: resolve(rootDir, 'tailwind.config.ts'),
      };

      // 先做一次一次性构建：入口可能以 `import css?inline` 引用该文件，缺失会让 vite 打包失败
      await buildTW({ ...tailwindArgs, ['--watch']: false });

      if (IS_DEV) {
        // tailwind 的 watch 模式返回永不 resolve 的 Promise，await 会阻塞后面的 vite build。
        // 只启动不等待：tailwind 后台重写 index.css，vite watcher 监听到后重新打包。
        void buildTW({ ...tailwindArgs, ['--watch']: 'always' });
      }
    }

    //@ts-expect-error This is hidden property from vite's resolveConfig()
    config.configFile = false;
    return build(config);
  });

// FIXME: USE THIS FOR ALL CONTENT SCRIPTs
export const contentBuilder = async ({
  matchesDir,
  srcDir,
  rootDir,
  contentName,
  withTw = true,
}: IContentBuilderProps) =>
  builds({
    srcDir,
    contentName,
    rootDir,
    matchesDir,
    withTw,
  });
