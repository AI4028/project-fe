import { watch } from 'chokidar';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, renameSync } from 'node:fs';

// Changes during a run queue another full pass. Both checks run even if one fails.
let revision = 0;
let running = false;
let timer;
let child;
let stopping = false;
let lastResult = null;
const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
function publish() {
  mkdirSync('.checks', { recursive: true });
  const current = !running && lastResult?.revision === revision;
  writeFileSync(
    '.checks/latest.tmp',
    JSON.stringify(
      {
        ...lastResult,
        revision,
        checkedRevision: lastResult?.revision ?? null,
        running,
        current,
        passed: current && lastResult.typecheck === 0 && lastResult.tests === 0,
      },
      null,
      2,
    ),
  );
  renameSync('.checks/latest.tmp', '.checks/latest.json');
}
function run(args) {
  return new Promise((resolve) => {
    child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
    child.once('error', () => resolve(1));
    child.once('exit', (code) => resolve(code ?? 1));
  });
}
async function check() {
  if (running || stopping) return;
  running = true;
  const checkedRevision = revision;
  publish();
  console.log(`\n[checks] Checking revision ${checkedRevision}`);
  const typecheck = await run(['tsc', '--noEmit']);
  const tests = stopping ? 1 : await run(['test']);
  lastResult = {
    revision: checkedRevision,
    typecheck,
    tests,
    completedAt: new Date().toISOString(),
  };
  running = false;
  publish();
  console.log(
    `[checks] ${typecheck === 0 && tests === 0 ? 'PASS' : 'FAIL'} revision ${checkedRevision}`,
  );
  if (checkedRevision !== revision) void check();
}
const watcher = watch('.', {
  ignored: (path) =>
    /(^|[/\\])(node_modules|\.git|\.expo|dist|coverage|\.checks|android|ios)([/\\]|$)/.test(path),
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 250, pollInterval: 50 },
});
watcher.on('all', (_event, path) => {
  if (path.endsWith('.DS_Store')) return;
  revision++;
  publish();
  clearTimeout(timer);
  timer = setTimeout(() => void check(), 250);
});
watcher.on('ready', () => void check());
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    stopping = true;
    clearTimeout(timer);
    child?.kill(signal);
    await watcher.close();
  });
