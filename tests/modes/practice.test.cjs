/* eslint-disable @typescript-eslint/no-require-imports -- uses the existing Node test harness. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./loader.cjs');

function setup() {
  const env = loadSource('mock');
  const { createMockPractice } = env.load('lib/practice/mock.ts');
  let time = Date.parse('2026-11-20T02:00:00Z'), serial = 0;
  const storage = { getItem: k => env.storage.get(k) ?? null, setItem: (k,v) => env.storage.set(k,v) };
  const api = createMockPractice(storage, 'user:1', () => time, () => 'id-' + (++serial));
  const input = api.detail('04').submission.input;
  return { api, input, env, storage, createMockPractice, advance: ms => time += ms };
}
test('P2 validates byte size, self-test integers and explicit confirmations', () => {
  const { env, input } = setup(); const { validateSubmission } = env.load('lib/practice/validation.ts');
  assert.equal(Object.keys(validateSubmission(input)).length, 0);
  assert.ok(validateSubmission({ ...input, code: '汉'.repeat(70000) }).code);
  assert.ok(validateSubmission({ ...input, passed: '5', total: '4' }).passed);
  assert.ok(validateSubmission({ ...input, total: '1.5' }).total);
  assert.ok(validateSubmission({ ...input, consent: false }).consent);
  assert.equal(validateSubmission({ ...input, testStatus: 'untested', passed: '', total: '' }).passed, undefined);
});
test('P2 draft versions, immutable submissions and idempotency', () => {
  const { api, input } = setup();
  const draft = api.saveDraft(input, 0);
  assert.equal(draft.version, 1);
  assert.throws(() => api.saveDraft(input, 0), e => e.code === 'CONFLICT');
  const id = api.submit(input, 'submit-1', 1);
  assert.equal(api.submit(input, 'submit-1', 1), id);
  assert.throws(() => api.submit({ ...input, title: 'different' }, 'submit-1', 0), e => e.code === 'CONFLICT');
  input.code = 'changed';
  assert.notEqual(api.detail(id).submission.input.code, 'changed');
  assert.equal(api.draft(), null);
});
test('P2 pending/processing/results survive reload; retries append history', () => {
  const { api, input, advance, createMockPractice, storage } = setup();
  const id = api.submit(input, 's', 0);
  assert.equal(api.detail(id).latest.status, 'pending');
  advance(2000); assert.equal(api.detail(id).latest.status, 'reviewing');
  assert.throws(() => api.retry(id, 'r'), e => e.code === 'RUNNING');
  advance(7000); assert.equal(api.detail(id).latest.result.score, 76);
  const failure = api.detail('01').selected.id;
  const retry = api.retry('01', 'retry'); assert.equal(api.retry('01', 'retry'), retry);
  assert.equal(api.detail('01', failure).selected.status, 'failed');
  assert.equal(api.detail('01').submission.attempts.length, 2);
  const reloaded = createMockPractice(storage, 'user:1');
  assert.equal(reloaded.detail(id).submission.id, id);
});
test('P2 untested has null score; evidence is in-range; writes are versioned', () => {
  const { api, input, advance } = setup();
  const id = api.submit({ ...input, code: 'x', testStatus: 'untested' }, 's', 0);
  advance(9000); const detail = api.detail(id);
  assert.equal(detail.selected.status, 'insufficient');
  assert.equal(detail.selected.result.score, null);
  assert.equal(detail.selected.result.grade, null);
  assert.equal(detail.selected.result.dimensions[0].score, null);
  assert.equal(detail.selected.result.evidence[0].end, 1);
  assert.equal(detail.submission.input.passed, '');
  const a = detail.selected;
  api.improve(id, a.id, 'improve-1', true, a.version);
  assert.throws(() => api.answer(id, a.id, 'followup-1', 'answer', a.version), e => e.code === 'CONFLICT');
  api.answer(id, a.id, 'followup-1', 'answer', a.version + 1);
  assert.equal(api.detail(id).selected.result.followups[0].answer, 'answer');
});
test('P2 filters, pagination, range statistics and missing scores are coherent', () => {
  const { api } = setup();
  assert.equal(api.overview('all', 1).history.length, 5);
  assert.equal(api.overview('all', 2).history.length, 1);
  assert.equal(api.overview('failed').total, 1);
  const week = api.statistics(7), month = api.statistics(30);
  assert.ok(month.submissions > week.submissions);
  assert.equal(month.scored, 3);
  assert.equal(month.points.length, 30);
  assert.ok(month.points.some(p => p.average === null));
  const fresh = api.detail('04').selected;
  api.improve('04', fresh.id, 'improve-1', true, fresh.version);
  assert.equal(api.statistics(30).improved, 1);
});
test('P2 unknown submission and Live boundary do not fabricate results or call endpoints', async () => {
  const { api } = setup(); assert.throws(() => api.detail('unknown'), e => e.code === 'NOT_FOUND');
  let calls = 0;
  const live = loadSource('live', () => { calls++; throw new Error('unexpected network'); }).load('lib/practice/service.ts');
  await assert.rejects(live.withPractice(api => api.overview()), e => e.code === 'NOT_CONNECTED');
  assert.equal(calls, 0);
});

test('P2 copied draft preserves parent metadata and a reset identity cannot see prior data', () => {
  const { api, input, createMockPractice, storage } = setup();
  const copy = { ...input, title: '复制后的修改', originSubmissionId: '04', consent: false, independent: false };
  api.saveDraft(copy, 0);
  const restored = api.draft();
  assert.equal(restored.input.originSubmissionId, '04'); assert.equal(restored.input.title, '复制后的修改');
  const newId = api.submit({ ...restored.input, consent: true, independent: true }, 'copy', restored.version, restored.input.originSubmissionId);
  assert.equal(api.detail(newId).submission.parentId, '04');
  assert.notEqual(api.detail('04').submission.input.title, '复制后的修改');
  const other = createMockPractice(storage, 'user:reset');
  assert.throws(() => other.detail(newId), e => e.code === 'NOT_FOUND');
});

test('P2 storage failure is explicit and cannot report a successful write', () => {
  const { createMockPractice } = setup();
  const api = createMockPractice({ getItem: () => null, setItem: () => { throw new Error('quota'); } }, 'user');
  assert.throws(() => api.overview(), e => e.code === 'STORAGE');
});
