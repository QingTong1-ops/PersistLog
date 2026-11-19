/* eslint-disable @typescript-eslint/no-require-imports -- Tests run directly in Node without another runner. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const { loadSource } = require('./loader.cjs');

async function setup() {
  const env = loadSource('mock');
  const client = env.load('lib/api/client.ts');
  const api = env.load('lib/api/live.ts').live;
  assert.equal(await client.refreshSession(), null);
  await api.auth.login('private@example.com', 'never-store-this-password');
  return { ...env, client, api };
}

test('launcher selects all nine commands, overrides inherited mode, rejects typo', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  for (const command of ['dev', 'build', 'start']) {
    assert.equal(pkg.scripts[command], `node scripts/run-mode.mjs ${command} live`);
    for (const mode of ['mock', 'live']) {
      const run = spawnSync(process.execPath, ['scripts/run-mode.mjs', command, mode, '--dry-run'], { encoding: 'utf8', env: { ...process.env, NEXT_PUBLIC_DATA_SOURCE: mode === 'mock' ? 'live' : 'mock' } });
      assert.equal(run.status, 0, run.stderr);
      const settings = JSON.parse(run.stdout); assert.equal(settings.env.NEXT_PUBLIC_DATA_SOURCE, mode);
      assert.ok(settings.dist.endsWith(mode));
    }
  }
  const invalid = spawnSync(process.execPath, ['scripts/run-mode.mjs', 'build', 'm0ck'], { encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.throws(() => loadSource('invalid').load('lib/config/data-source.ts'));
});

test('mock auth, refresh and logout use isolated storage, never persist credentials', async () => {
  const { api, client, storage } = await setup();
  assert.equal((await api.auth.me()).email, 'demo@persistlog.test');
  assert.equal(await client.refreshSession(), 'mock-session');
  const restored = loadSource('mock', undefined, storage).load('lib/api/client.ts');
  assert.equal(await restored.refreshSession(), 'mock-session');
  const saved = [...storage.values()].join('');
  assert.ok(!saved.includes('never-store-this-password')); assert.ok(!saved.includes('private@example.com'));
  await api.auth.logout(); assert.equal(await client.refreshSession(), null);
  await assert.rejects(api.today.get(), e => e.status === 401);
});

test('today writes update route progress and dashboard, concurrent writes do not lose data', async () => {
  const { api } = await setup();
  const before = await api.today.get();
  const pending = before.items.find(i => i.status === 'pending');
  await api.today.action(pending.id, 'start');
  await api.today.action(pending.id, 'complete', { actual_minutes: 65 });
  assert.equal((await api.today.get()).summary.completed_tasks, 2);
  assert.equal((await api.dashboard.overview(7)).completed_tasks, 2);
  assert.equal((await api.routes.list())[0].progress.completed_tasks, 2);
  await Promise.all(['任务甲', '任务乙'].map(title => api.today.addItem({ title, estimated_minutes: 30 })));
  assert.equal((await api.today.get()).items.length, before.items.length + 2);
  assert.equal((await api.dashboard.trends(7)).points.length, 7);
  assert.equal((await api.dashboard.trends(30)).points.length, 30);
});

test('task actions, route lifecycle and profile writes remain local', async () => {
  const { api } = await setup();
  const t = (await api.today.get()).items[1];
  await api.today.action(t.id, 'block', { reason: '演示阻塞' });
  assert.equal((await api.today.get()).items[1].status, 'blocked');
  await api.today.action(t.id, 'unblock');
  await api.today.action(t.id, 'postpone');
  const r = await api.routes.create({ title: '演示新路线', start_date: '2026-11-19', daily_capacity_minutes: 120 });
  await api.routes.action(r.id, 'activate'); await api.routes.action(r.id, 'pause');
  assert.equal((await api.routes.get(r.id)).status, 'paused');
  await api.routes.adjust(r.id, { daily_capacity_minutes: 150 });
  assert.equal((await api.routes.get(r.id)).current_version, 2);
  await api.profile.update({ daily_available_minutes: 200, planning_capacity_factor: 0.5 });
  assert.equal((await api.today.get()).capacity_minutes, 100);
});

test('import preview/edit/confirm/rollback is simulated and confirmation does not duplicate routes', async () => {
  const { api } = await setup();
  const file = new File(['# A private plan'], 'plan.md', { type: 'text/markdown' });
  await assert.rejects(api.imports.create(file), e => e.code === 'CONSENT_REQUIRED');
  await api.profile.setConsent({ scope: 'ai_import', version: 'v1', granted: true });
  const created = await api.imports.create(file);
  assert.equal((await api.imports.job(created.job_id)).status, 'succeeded');
  const preview = await api.imports.preview(created.import_id);
  preview.route.stages[0].weeks[0].tasks[0].title = '编辑后的演示任务';
  await api.imports.updatePreview(created.import_id, preview.route);
  const confirmed = await api.imports.confirm(created.import_id);
  assert.equal((await api.imports.confirm(created.import_id)).route_id, confirmed.route_id);
  assert.equal((await api.routes.list()).length, 2);
  assert.ok((await api.today.get()).items.some(i => i.title === '编辑后的演示任务'));
  await api.imports.rollback(created.import_id);
  assert.equal((await api.routes.list()).length, 1);
});

test('notifications simulate sending, unknown APIs fail closed, reset returns login state', async () => {
  const { api, client, load, storage } = await setup();
  const channel = await api.notifications.createChannel({ name: '演示群', webhook_url: 'https://example.com/secret-key' });
  assert.equal((await api.notifications.test(channel.id)).simulated, true);
  assert.equal((await api.notifications.outbox()).length, 1);
  assert.ok(![...storage.values()].join('').includes('secret-key'));
  await api.notifications.deleteChannel(channel.id);
  assert.equal((await api.notifications.channels()).length, 0);
  await assert.rejects(client.apiFetch('/practice'), e => e.status === 501 && e.code === 'MOCK_NOT_IMPLEMENTED');
  load('lib/api/mock/p1.ts').resetMockData(); assert.equal(await client.refreshSession(), null);
});

test('live uses fetch and never falls back on error; query params cannot choose mock', async () => {
  const calls = [];
  const env = loadSource('live', async url => { calls.push(url); return Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: '后端离线' } }, { status: 503 }); });
  const api = env.load('lib/api/client.ts');
  await assert.rejects(api.apiFetch('/today?source=mock'), e => e.status === 503 && e.code === 'SERVICE_UNAVAILABLE');
  assert.equal(calls.length, 1); assert.equal(calls[0], '/api/v1/today?source=mock');
  assert.equal(env.storage.size, 0);
  assert.equal(await api.refreshSession(), null);
});

test('live refresh still uses single-flight and retries the authenticated request', async () => {
  let refreshes = 0;
  const env = loadSource('live', async (url, init) => {
    if (url.endsWith('/auth/refresh')) { refreshes++; return Response.json({ access_token: 'real-token' }); }
    if (init.headers.get('Authorization') !== 'Bearer real-token') return Response.json({}, { status: 401 });
    return Response.json({ source: 'real-api' });
  });
  const client = env.load('lib/api/client.ts');
  const [a, b] = await Promise.all([client.apiFetch('/today'), client.apiFetch('/profile')]);
  assert.equal(a.source, 'real-api'); assert.equal(b.source, 'real-api'); assert.equal(refreshes, 1);
});

test('store has no fixture fallback and uses adapter-backed branch on error', () => {
  const source = fs.readFileSync('lib/store/app-store.tsx', 'utf8');
  assert.ok(!source.includes('INITIAL_TASKS')); assert.ok(!source.includes('setIsLive(false)'));
  assert.ok(source.includes('live: true'));
});
