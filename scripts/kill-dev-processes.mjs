import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Kills leftover dev processes (turbo watch / vite build --watch / tsx / HMR
 * server) from a previous interrupted `pnpm dev` run.
 *
 * On Windows, Ctrl+C does not always propagate through the
 * pnpm -> turbo -> node process tree, so orphaned watchers keep holding
 * `dist/` file handles and port 8081, which breaks the next `pnpm dev` startup.
 *
 * Why a Node script and not bash: `bash` on Windows may resolve to WSL's
 * System32 bash depending on PATH order, which would inspect the Linux process
 * table instead of the Windows one. `node` is guaranteed by pnpm itself.
 *
 * Safety: only processes whose command line contains this project's root path
 * AND a dev-tool signature are killed. IDE language servers (tsserver), other
 * projects, and the pnpm/node processes invoking this script never match.
 */

// Dev-tool signatures. Must NOT be substrings of a bare project path, otherwise
// the path alone (e.g. "...react-vite") would satisfy the match.
const SIGNATURE = /vite\.js|turbo|tsx|tailwindcss|reload-server/;

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const normalize = commandLine => commandLine.replaceAll('\\', '/').toLowerCase();

function listLeftoversOnWindows() {
  const script = [
    '$root = ($env:KILL_ROOT -replace "\\\\", "/").ToLower()',
    'Get-CimInstance Win32_Process | Where-Object {',
    '  ($_.Name -eq "node.exe" -or $_.Name -eq "esbuild.exe") -and',
    '  ($cl = $_.CommandLine) -and',
    '  ($cl -replace "\\\\", "/").ToLower().Contains($root) -and',
    '  $cl -match "vite\\.js|turbo|tsx|tailwindcss|reload-server"',
    '} | ForEach-Object { "{0}|{1}" -f $_.ProcessId, ($_.CommandLine -replace "[\\r\\n]", " ") }',
  ].join('\n');

  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', script], {
    encoding: 'utf8',
    env: { ...process.env, KILL_ROOT: projectRoot },
  });

  if (result.error) {
    console.error(`Failed to query processes: ${result.error.message}`);
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const separator = line.indexOf('|');
      return { pid: Number.parseInt(line.slice(0, separator), 10), commandLine: line.slice(separator + 1) };
    })
    .filter(({ pid }) => Number.isInteger(pid) && pid !== process.pid);
}

function listLeftoversOnUnix() {
  const pattern = `${projectRoot}.*${SIGNATURE.source}`;
  const result = spawnSync('pgrep', ['-f', pattern], { encoding: 'utf8' });

  if (result.error || result.status !== 0) {
    return [];
  }

  return result.stdout
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(pid => ({ pid: Number.parseInt(pid, 10), commandLine: pattern }))
    .filter(({ pid }) => Number.isInteger(pid) && pid !== process.pid);
}

const isWindows = process.platform === 'win32';
const leftovers = isWindows ? listLeftoversOnWindows() : listLeftoversOnUnix();

if (leftovers.length === 0) {
  console.log('No leftover dev processes found');
  process.exit(0);
}

if (isWindows) {
  // /T also terminates the esbuild service children spawned by vite.
  spawnSync('taskkill', ['/F', '/T', ...leftovers.flatMap(({ pid }) => ['/PID', String(pid)])], {
    stdio: 'ignore',
  });
} else {
  // kill -9 supports batching pids: kill -9 1 2 3
  spawnSync('kill', ['-9', ...leftovers.map(({ pid }) => String(pid))], { stdio: 'ignore' });
}

for (const { pid, commandLine } of leftovers) {
  const shortCommand = commandLine.replace(/^.*node_modules/, 'node_modules').slice(0, 80);
  console.log(`Killed leftover dev process: PID ${pid} (${shortCommand})`);
}
