import { config } from '@dotenvx/dotenvx';
import { resolve } from 'node:path';

// import.meta.dirname = packages/env/dist/lib
// Go up 4 levels: lib -> dist -> env -> packages -> project root
const rootEnvPath = resolve(import.meta.dirname, '../../../../.env');

// Read root .env to determine mode
const rootEnv = config({ path: rootEnvPath }).parsed ?? {};
const mode = rootEnv.CLI_CEB_DEV === 'true' ? 'development' : 'production';

// Try loading mode-specific config first, fallback to root .env
const modeEnvPath = rootEnvPath.replace(/\.env$/, `.env.${mode}`);
const modeEnv = config({ path: modeEnvPath }).parsed;

export const baseEnv = modeEnv ?? rootEnv;

export const dynamicEnvValues = {
  CEB_NODE_ENV: mode === 'development' ? 'development' : 'production',
} as const;
