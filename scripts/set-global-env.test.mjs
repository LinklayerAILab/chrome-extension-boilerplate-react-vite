import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { updateGlobalEnv } from './set-global-env.mjs';

const makeEnvFile = async lines => {
  const directory = await mkdtemp(join(tmpdir(), 'ceb-env-'));
  const envPath = join(directory, '.env');
  await writeFile(envPath, lines.join('\n'));
  return envPath;
};

test('updates CLI values while preserving editable CEB values', async () => {
  const envPath = await makeEnvFile([
    '# THOSE VALUES ARE EDITABLE ONLY VIA CLI',
    'CLI_CEB_DEV=false',
    'CLI_CEB_FIREFOX=false',
    '',
    '# THOSE VALUES ARE EDITABLE',
    'CEB_AGENT_C_API=https://api.example.test',
    'CEB_CHAIN_ID=97',
    '',
  ]);

  await updateGlobalEnv(envPath, ['CLI_CEB_DEV=true', 'CLI_CEB_FIREFOX=true']);

  assert.equal(
    await readFile(envPath, 'utf8'),
    [
      '# THOSE VALUES ARE EDITABLE ONLY VIA CLI',
      'CLI_CEB_DEV=true',
      'CLI_CEB_FIREFOX=true',
      'CLI_CEB_ENV=dev',
      '',
      '# THOSE VALUES ARE EDITABLE',
      'CEB_AGENT_C_API=https://api.example.test',
      'CEB_CHAIN_ID=97',
      '',
    ].join('\n'),
  );
});

test('rejects non-CEB keys in the editable section', async () => {
  const envPath = await makeEnvFile([
    'CLI_CEB_DEV=false',
    'CLI_CEB_FIREFOX=false',
    '',
    'CEB_CHAIN_ID=97',
    'UNRELATED_VALUE=true',
    '',
  ]);

  await assert.rejects(
    updateGlobalEnv(envPath, ['CLI_CEB_DEV=true']),
    /Invalid key: <UNRELATED_VALUE>\. All keys in the editable section must start with 'CEB_'\./,
  );
});

test('explicit CLI_CEB_ENV overrides the derived preset', async () => {
  const envPath = await makeEnvFile([
    '# THOSE VALUES ARE EDITABLE ONLY VIA CLI',
    'CLI_CEB_DEV=false',
    'CLI_CEB_FIREFOX=false',
    '',
    '# THOSE VALUES ARE EDITABLE',
    'CEB_CHAIN_ID=97',
    '',
  ]);

  // 生产形态（CLI_CEB_DEV=false）+ 测试环境配置
  await updateGlobalEnv(envPath, ['CLI_CEB_DEV=false', 'CLI_CEB_ENV=test']);

  const content = await readFile(envPath, 'utf8');
  assert.match(content, /CLI_CEB_DEV=false/);
  assert.match(content, /CLI_CEB_ENV=test/);
});

test('keeps existing CLI_CEB_ENV when not specified', async () => {
  const envPath = await makeEnvFile([
    '# THOSE VALUES ARE EDITABLE ONLY VIA CLI',
    'CLI_CEB_DEV=false',
    'CLI_CEB_FIREFOX=false',
    'CLI_CEB_ENV=test',
    '',
    '# THOSE VALUES ARE EDITABLE',
    'CEB_CHAIN_ID=97',
    '',
  ]);

  // 未传 CLI_CEB_ENV：应保留 test，而不是被推导成 prod
  await updateGlobalEnv(envPath, ['CLI_CEB_DEV=false']);

  assert.match(await readFile(envPath, 'utf8'), /CLI_CEB_ENV=test/);
});

test('rejects invalid CLI_CEB_ENV values', async () => {
  const envPath = await makeEnvFile(['CLI_CEB_DEV=false', '', 'CEB_CHAIN_ID=97', '']);

  await assert.rejects(updateGlobalEnv(envPath, ['CLI_CEB_ENV=staging']), /Invalid value for <CLI_CEB_ENV>/);
});
