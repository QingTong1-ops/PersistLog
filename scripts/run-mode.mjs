import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [command, mode, ...args] = process.argv.slice(2);
if (!['dev', 'build', 'start'].includes(command) || !['mock', 'live'].includes(mode)) {
  console.error('Usage: node scripts/run-mode.mjs <dev|build|start> <mock|live> [Next options]');
  process.exit(1);
}
const require = createRequire(import.meta.url);
const next = require.resolve('next/dist/bin/next');
const dist = resolve(root, '.next', mode);
const manifest = resolve(dist, 'data-source.json');
const env = { ...process.env, NEXT_PUBLIC_DATA_SOURCE: mode };
if (args.includes('--dry-run')) {
  console.log(JSON.stringify({ command, mode, dist, next, cwd: root, env: { NEXT_PUBLIC_DATA_SOURCE: mode } }));
  process.exit(0);
}
if (command === 'start') {
  let metadata;
  try { metadata = JSON.parse(readFileSync(manifest, 'utf8')); } catch { /* checked below */ }
  if (!existsSync(resolve(dist, 'BUILD_ID')) || metadata?.mode !== mode || metadata?.buildId !== readFileSync(resolve(dist, 'BUILD_ID'), 'utf8').trim()) {
    console.error(`Missing or mismatched ${mode} build. Run pnpm build:${mode} first.`);
    process.exit(1);
  }
}
console.log(`[persistLog] ${command}:${mode} | output: .next/${mode} | ${mode === 'mock' ? 'DEMO ONLY — no backend requests' : 'real API — no mock fallback'}`);
const child = spawn(process.execPath, [next, command, ...args], { cwd: root, env, stdio: 'inherit', shell: false });
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code, signal) => {
  if (command === 'build' && code === 0) {
    writeFileSync(manifest, JSON.stringify({ mode, buildId: readFileSync(resolve(dist, 'BUILD_ID'), 'utf8').trim() }, null, 2) + '\n');
  }
  process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1);
});
