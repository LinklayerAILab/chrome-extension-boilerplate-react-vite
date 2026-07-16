import env, { IS_DEV, IS_PROD } from '@extension/env';
import { watchRebuildPlugin } from '@extension/hmr';
import react from '@vitejs/plugin-react-swc';
import deepmerge from 'deepmerge';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import type { UserConfig } from 'vite';

// Build explicit define entries for env vars used in browser code
const envDefine: Record<string, string> = {};
for (const [key, value] of Object.entries(env)) {
  envDefine[`process.env.${key}`] = JSON.stringify(value);
}

// Debug: log env vars being injected
console.log('[vite-config] Injecting env vars:', Object.keys(envDefine));

export const watchOption = IS_DEV
  ? {
      chokidar: {
        awaitWriteFinish: true,
      },
    }
  : undefined;

export const withPageConfig = (config: UserConfig) =>
  defineConfig(
    deepmerge(
      {
        define: {
          ...envDefine,
          'process.env': env,
        },
        base: '',
        plugins: [react(), IS_DEV && watchRebuildPlugin({ refresh: true }), nodePolyfills()],
        build: {
          sourcemap: IS_DEV,
          minify: IS_PROD,
          reportCompressedSize: IS_PROD,
          emptyOutDir: IS_PROD,
          watch: watchOption,
          rollupOptions: {
            external: ['chrome'],
          },
        },
      },
      config,
    ),
  );
