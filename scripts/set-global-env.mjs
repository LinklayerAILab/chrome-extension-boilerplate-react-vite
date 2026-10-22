import { readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const cliDefaults = {
  CLI_CEB_DEV: 'false',
  CLI_CEB_FIREFOX: 'false',
};

/** 环境预设允许值：dev（开发）/ test（测试环境生产构建）/ prod（生产） */
const ENV_PRESETS = ['dev', 'test', 'prod'];

const parseArgument = argument => {
  const separator = argument.indexOf('=');
  const key = separator === -1 ? argument : argument.slice(0, separator);
  const value = separator === -1 ? '' : argument.slice(separator + 1);

  if (!/^CLI_CEB_/.test(key)) {
    throw new Error(`Invalid key: <${key}>. All CLI keys must start with 'CLI_CEB_'.`);
  }

  if (!(key in cliDefaults) && key !== 'CLI_CEB_ENV') {
    throw new Error(`Invalid key: <${key}>.`);
  }

  if (key === 'CLI_CEB_ENV') {
    if (!ENV_PRESETS.includes(value)) {
      throw new Error(`Invalid value for <${key}>. Please use one of: ${ENV_PRESETS.join(', ')}.`);
    }
    return [key, value];
  }

  if (value !== 'true' && value !== 'false') {
    throw new Error(`Invalid value for <${key}>. Please use 'true' or 'false'.`);
  }

  return [key, value];
};

const getEditableValues = envContent => {
  const values = [];
  let editableSectionStarted = false;

  for (const line of envContent.split(/\r?\n/)) {
    const key = line.slice(0, line.indexOf('='));

    if (key.startsWith('CLI_CEB_')) {
      editableSectionStarted = true;
      continue;
    }

    if (!editableSectionStarted || line === '' || line.startsWith('#')) {
      continue;
    }

    if (!key.startsWith('CEB_')) {
      throw new Error(`Invalid key: <${key}>. All keys in the editable section must start with 'CEB_'.`);
    }

    values.push(line);
  }

  return values;
};

/** 读取 .env 中已有的 CLI_CEB_ENV 值（没有则返回 undefined） */
const readExistingPreset = envContent => {
  for (const line of envContent.split(/\r?\n/)) {
    if (line.startsWith('CLI_CEB_ENV=')) {
      const value = line.slice('CLI_CEB_ENV='.length).trim();
      return ENV_PRESETS.includes(value) ? value : undefined;
    }
  }
  return undefined;
};

export const updateGlobalEnv = async (envPath, argumentsList) => {
  const envContent = await readFile(envPath, 'utf8');
  const cliValues = { ...cliDefaults };
  /** 是否显式传入了 CLI_CEB_ENV；未传则沿用旧值，再退化为按 CLI_CEB_DEV 推导 */
  let envPreset;

  for (const argument of argumentsList) {
    const [key, value] = parseArgument(argument);
    if (key === 'CLI_CEB_ENV') {
      envPreset = value;
      continue;
    }
    cliValues[key] = value;
  }

  if (envPreset === undefined) {
    // 未显式指定：保留文件中已有的值，否则按构建形态推导（dev → dev，其余 → prod）
    envPreset = readExistingPreset(envContent) ?? (cliValues.CLI_CEB_DEV === 'true' ? 'dev' : 'prod');
  }

  const content = [
    '# THOSE VALUES ARE EDITABLE ONLY VIA CLI',
    `CLI_CEB_DEV=${cliValues.CLI_CEB_DEV}`,
    `CLI_CEB_FIREFOX=${cliValues.CLI_CEB_FIREFOX}`,
    `CLI_CEB_ENV=${envPreset}`,
    '',
    '# THOSE VALUES ARE EDITABLE',
    ...getEditableValues(envContent),
    '',
  ].join('\n');
  const temporaryPath = `${envPath}.tmp`;

  await writeFile(temporaryPath, content);
  await rename(temporaryPath, envPath);
};

const isMainModule = process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename);

if (isMainModule) {
  const envPath = resolve(dirname(import.meta.filename), '..', '.env');
  updateGlobalEnv(envPath, process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
