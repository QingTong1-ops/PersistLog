import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';

const require = createRequire(import.meta.url);
const next = require.resolve('next/dist/bin/next');
const delay = ms => new Promise(r => setTimeout(r, ms));
async function freePort() {
  const probe = createServer();
  await new Promise(r => probe.listen(0, '127.0.0.1', r));
  const port = probe.address().port;
  await new Promise(r => probe.close(r)); return port;
}
for (const mode of ['mock', 'live']) {
  const marker = JSON.parse(readFileSync(`.next/${mode}/data-source.json`, 'utf8'));
  assert.equal(marker.mode, mode);
  assert.equal(marker.buildId, readFileSync(`.next/${mode}/BUILD_ID`, 'utf8').trim());
  const manifest = JSON.parse(readFileSync(`.next/${mode}/routes-manifest.json`, 'utf8'));
  const rewrites = Array.isArray(manifest.rewrites) ? manifest.rewrites : Object.values(manifest.rewrites).flat();
  assert.equal(rewrites.some(r => r.source.startsWith('/api/v1')), mode === 'live');
  const port = await freePort();
  // Own only this preview process. Do not stop a user's existing dev server.
  const child = spawn(process.execPath, [next, 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    env: { ...process.env, NEXT_PUBLIC_DATA_SOURCE: mode }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', b => log += b); child.stderr.on('data', b => log += b);
  const base = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try { ready = (await fetch(`${base}/login`)).ok; } catch { /* server warming up */ }
      if (ready) break;
      await delay(500);
    }
    assert.ok(ready, log);
    for (const page of ['/login', '/today', '/dashboard', '/routes', '/routes/1', '/import', '/settings/profile', '/settings/notifications', '/settings/ai', '/settings/data', '/onboarding']) {
      const response = await fetch(base + page);
      const html = await response.text();
      assert.equal(response.status, 200, page);
      assert.ok(html.includes(`data-source="${mode}"`), page);
      if (page === '/login') assert.equal(html.includes('仅本标签页模拟保存'), mode === 'mock');
    }
    const root = await fetch(base, { redirect: 'manual' });
    assert.equal(root.status, 307); assert.equal(root.headers.get('location'), '/login');
    console.log(`${mode}: build marker, rewrite isolation, root redirect and 11 route shells passed`);
  } finally {
    child.kill();
    await new Promise(r => child.once('close', r));
  }
}
