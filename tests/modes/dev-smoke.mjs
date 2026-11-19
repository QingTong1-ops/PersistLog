import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';

const delay = ms => new Promise(r => setTimeout(r, ms));
for (const mode of ['mock', 'live']) {
  const probe = createServer();
  await new Promise(r => probe.listen(0, '127.0.0.1', r));
  const port = probe.address().port;
  await new Promise(r => probe.close(r));
  const child = spawn(process.execPath, ['scripts/run-mode.mjs', 'dev', mode, '--hostname', '127.0.0.1', '--port', String(port)], {
    env: { ...process.env, NEXT_PUBLIC_DATA_SOURCE: mode === 'mock' ? 'live' : 'mock' },
    detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', b => log += b); child.stderr.on('data', b => log += b);
  try {
    let html = '';
    for (let i = 0; i < 60; i++) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/login`, { signal: AbortSignal.timeout(30000) });
        if (response.ok) { html = await response.text(); break; }
      } catch { /* dev server compiling */ }
      await delay(500);
    }
    assert.ok(html.includes(`data-source="${mode}"`), log);
    assert.equal(html.includes('仅本标签页模拟保存'), mode === 'mock');
    console.log(`dev:${mode}: actual launcher, inherited environment override and login SSR passed`);
  } finally {
    // Terminate only the process tree this test created, never a user's existing server/port.
    if (process.platform === 'win32') {
      const cleanup = spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { encoding: 'utf8' });
      if (cleanup.status !== 0 && child.exitCode === null) {
        child.stdout.destroy(); child.stderr.destroy(); child.unref();
        throw new Error(`Could not clean up owned preview PID ${child.pid}: ${cleanup.stderr}`);
      }
    }
    else { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already exited */ } }
  }
}
