import { EMPTY_INPUT, PracticeError, type CodeStatistics, type Draft, type HistoryFilter, type PracticeOverview,
  type ReviewAttempt, type ReviewDetail, type ReviewResult, type Submission, type SubmissionInput } from './types';
import { normalizeInput, validateSubmission, MAX_CODE_BYTES } from './validation';

export const PRACTICE_STORAGE_KEY = 'persistlog:mock:practice:v1';
interface Storage { getItem(key: string): string | null; setItem(key: string, value: string): void }
interface Database {
  version: 1; owner: string; draft: Draft | null; submissions: Submission[];
  operations: Record<string, { signature: string; result: string }>;
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const DEMO_CODE = ['from collections import OrderedDict', 'from time import monotonic', '', 'class LRUCache:',
  '    def __init__(self, capacity, ttl):', '        self.capacity = capacity', '        self.ttl = ttl',
  '        self.entries = OrderedDict()', '', '    def get(self, key):', '        entry = self.entries.get(key)',
  '        if entry is None:', '            return None', '        return entry[0]'].join('\n');

/** Testable demo data source. State simulation lives here, never inside the React pages. */
export function createMockPractice(storage: Storage, owner: string, clock = () => Date.now(), makeId = () => crypto.randomUUID()) {
  const iso = () => new Date(clock()).toISOString();
  function resultFor(input: SubmissionInput, score = 76): ReviewResult {
    const untested = input.testStatus === 'untested';
    const lines = input.code.split('\n');
    const start = Math.min(10, lines.length), end = Math.min(start + 3, lines.length);
    return {
      score: untested ? null : score, grade: untested ? null : 'B+', confidence: 0.82, risk: '中（演示）',
      dimensions: ['正确性风险', '复杂度', '代码质量', '测试与验证', '表达与复盘'].map((label, i) => ({ label,
        score: untested && (i === 0 || i === 3) ? null : [62, 80, 74, 60, 70][i],
        reason: untested && (i === 0 || i === 3) ? '未提供自测，只说明静态风险，不予评分。' : '预置评审维度，仅用于演示，不代表系统实际检查了代码。' })),
      evidence: [{ id: 'evidence-1', fileName: input.fileName, start, end, snippet: lines.slice(start - 1, end).join('\n'),
        explanation: '演示证据定位：检查此处的读取分支是否覆盖过期、空值等边界；并非对当前代码的真实诊断。' }],
      improvements: [
        { id: 'improve-1', title: '补齐边界自测', method: '明确空输入、过期值的预期行为。', verification: '补充一个失败用例与修正后的自测记录。', completed: false },
        { id: 'improve-2', title: '说明复杂度取舍', method: '将关键操作与复杂度说明对应。', verification: '逐项解释查询、写入与淘汰成本。', completed: false },
        { id: 'improve-3', title: '记录修改依据', method: '保留原方案与改动理由。', verification: '新提交附上变更及验证说明。', completed: false },
      ],
      followups: [{ id: 'followup-1', question: '你会如何设计边界用例来验证这份代码？', answer: '' },
        { id: 'followup-2', question: '如果输入规模增加，你会重新考虑哪个设计取舍？', answer: '' }],
    };
  }
  function attempt(input: SubmissionInput, number: number, createdAt: string, status: ReviewAttempt['status'] = 'pending', score = 76): ReviewAttempt {
    return { id: makeId(), number, version: 1, status, createdAt,
      finishedAt: ['pending', 'reviewing'].includes(status) ? null : createdAt,
      error: status === 'failed' ? '演示评审服务暂时不可用，提交内容已保留。' : null,
      result: ['succeeded', 'insufficient'].includes(status) ? resultFor(input, score) : null };
  }
  function seed(): Database {
    const input: SubmissionInput = { ...EMPTY_INPUT, title: '实现支持过期时间的 LRU 缓存',
      code: DEMO_CODE, difficulty: '中等', tags: '缓存, 数据结构', source: '学习路线 · 第 3 阶段（演示）',
      timeComplexity: '平均 O(1)', spaceComplexity: 'O(capacity)', passed: '3', total: '4',
      failedTest: '过期键再次读取时仍返回旧值。', independent: true, consent: true };
    const examples: { id: string; title: string; days: number; status: ReviewAttempt['status']; score?: number }[] = [
      { id: '05', title: '为订单服务补充幂等键校验', days: 0, status: 'pending' },
      { id: '04', title: input.title, days: 1, status: 'succeeded' },
      { id: '03', title: '二叉树层序遍历', days: 3, status: 'succeeded', score: 88 },
      { id: '02', title: '两数之和的边界处理', days: 8, status: 'succeeded', score: 84 },
      { id: '01', title: '线程池参数调优实验', days: 12, status: 'failed' },
      { id: '06', title: '尚未自测的代码提交', days: 2, status: 'insufficient' },
    ];
    return { version: 1, owner, draft: null, operations: {}, submissions: examples.map(e => {
      const snapshot = { ...input, title: e.title, ...(e.status === 'insufficient' ? { testStatus: 'untested' as const, passed: '', total: '', failedTest: '' } : {}) };
      const date = new Date(clock() - e.days * 86400000).toISOString();
      const attempts = e.id === '04' ? [attempt(snapshot, 1, date, 'failed'), attempt(snapshot, 2, date, e.status, e.score)] : [attempt(snapshot, 1, date, e.status, e.score)];
      return { id: e.id, input: snapshot, createdAt: date, attempts };
    }) };
  }
  function write(db: Database) {
    try { storage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(db)); }
    catch { throw new PracticeError('STORAGE', '浏览器无法保存演示数据，请检查会话存储权限或空间。输入不会被清空。'); }
  }
  function read(): Database {
    let db: Database;
    try {
      const raw = storage.getItem(PRACTICE_STORAGE_KEY);
      db = raw ? JSON.parse(raw) : null;
    } catch { throw new PracticeError('STORAGE', '无法读取演示数据，请使用页面右下角重置演示。'); }
    if (!db || db.version !== 1 || db.owner !== owner) { db = seed(); write(db); }
    let changed = false;
    for (const sub of db.submissions) for (const a of sub.attempts) {
      if (a.status !== 'pending' && a.status !== 'reviewing') continue;
      const elapsed = clock() - Date.parse(a.createdAt);
      if (elapsed >= 8000) {
        a.status = sub.input.testStatus === 'untested' ? 'insufficient' : 'succeeded';
        a.finishedAt = new Date(Date.parse(a.createdAt) + 8000).toISOString(); a.result = resultFor(sub.input); changed = true;
      } else if (elapsed >= 1000 && a.status === 'pending') { a.status = 'reviewing'; changed = true; }
    }
    if (changed) write(db);
    return db;
  }
  function find(db: Database, id: string) {
    const item = db.submissions.find(s => s.id === id);
    if (!item) throw new PracticeError('NOT_FOUND', '找不到这次提交，演示数据可能已重置。');
    return item;
  }
  function selected(sub: Submission, reviewId?: string) {
    const a = reviewId ? sub.attempts.find(a => a.id === reviewId) : sub.attempts.at(-1);
    if (!a) throw new PracticeError('NOT_FOUND', '找不到指定评审记录。');
    return a;
  }
  function checkVersion(actual: number, expected: number) {
    if (actual !== expected) throw new PracticeError('CONFLICT', '记录已在另一处更新。你的输入已保留，请重新读取后决定是否保存。');
  }
  function repeated(db: Database, key: string, signature: string) {
    if (!key) throw new PracticeError('KEY_REQUIRED', '操作标识缺失，请重试。');
    const op = db.operations[key];
    if (op && op.signature !== signature) throw new PracticeError('CONFLICT', '操作内容已变化，请重新确认提交。');
    return op?.result;
  }
  return {
    overview(filter: HistoryFilter = 'all', page = 1): PracticeOverview {
      const db = read(); const all = [...db.submissions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const rows = all.filter(s => { const status = selected(s).status; return filter === 'all' || (filter === 'pending' ? status === 'pending' || status === 'reviewing' : filter === status); });
      const currentPage = Math.max(1, Math.min(Math.ceil(rows.length / 5) || 1, page));
      return clone({ currentTask: { title: '实现支持过期时间的 LRU 缓存', source: '学习路线 · 第 3 阶段（演示）', minutes: 60 },
        history: rows.slice((currentPage - 1) * 5, currentPage * 5), total: rows.length, page: currentPage, pageSize: 5,
        improvements: all.flatMap(s => (selected(s).result?.improvements ?? []).filter(i => !i.completed).map(item => ({ submissionId: s.id, reviewId: selected(s).id, item }))).slice(0, 3) });
    },
    draft(): Draft | null { return clone(read().draft); },
    saveDraft(input: SubmissionInput, expectedVersion: number): Draft {
      if (new TextEncoder().encode(input.code).byteLength > MAX_CODE_BYTES) throw new PracticeError('VALIDATION', '代码不能超过 200 KiB。', { code: '代码不能超过 200 KiB。' });
      const db = read(); checkVersion(db.draft?.version ?? 0, expectedVersion);
      db.draft = { id: db.draft?.id ?? makeId(), version: expectedVersion + 1, savedAt: iso(), input: clone(input) };
      write(db); return clone(db.draft);
    },
    deleteDraft(expectedVersion: number) { const db = read(); checkVersion(db.draft?.version ?? 0, expectedVersion); db.draft = null; write(db); },
    submit(input: SubmissionInput, key: string, draftVersion: number, parentId?: string): string {
      const normalized = normalizeInput(input), signature = JSON.stringify({ normalized, parentId });
      const db = read(); const existing = repeated(db, key, signature); if (existing) return existing;
      const fields = validateSubmission(normalized); if (Object.keys(fields).length) throw new PracticeError('VALIDATION', '请修正表单中的问题。', fields);
      checkVersion(db.draft?.version ?? 0, draftVersion);
      if (parentId) find(db, parentId);
      const sub: Submission = { id: makeId(), createdAt: iso(), input: clone(normalized), parentId,
        attempts: [attempt(normalized, 1, iso())] };
      db.submissions.unshift(sub); db.draft = null; db.operations[key] = { signature, result: sub.id }; write(db); return sub.id;
    },
    detail(id: string, reviewId?: string): ReviewDetail {
      const sub = find(read(), id), a = selected(sub, reviewId), latest = selected(sub);
      const progress = a.status === 'pending' ? 0 : a.status === 'reviewing' ? Math.min(95, Math.round((clock() - Date.parse(a.createdAt)) / 80)) : a.status === 'failed' ? 35 : 100;
      return clone({ submission: sub, selected: a, latest, progress, updatedAt: iso(),
        stage: a.status === 'failed' ? '演示处理失败' : progress === 100 ? '演示评审结束' : progress < 30 ? '接收代码快照（模拟）' : progress < 65 ? '静态分析与自测对照（模拟）' : '整理证据与反馈（模拟）' });
    },
    retry(id: string, key: string): string {
      const db = read(); const signature = 'retry:' + id, existing = repeated(db, key, signature); if (existing) return existing;
      const sub = find(db, id); const last = selected(sub);
      if (['pending', 'reviewing'].includes(last.status)) throw new PracticeError('RUNNING', '已有评审正在进行，请等待或刷新进度。');
      const a = attempt(sub.input, sub.attempts.length + 1, iso()); sub.attempts.push(a);
      db.operations[key] = { signature, result: a.id }; write(db); return a.id;
    },
    improve(id: string, reviewId: string, itemId: string, completed: boolean, version: number) {
      const db = read(), a = selected(find(db, id), reviewId); checkVersion(a.version, version);
      const item = a.result?.improvements.find(i => i.id === itemId);
      if (!item) throw new PracticeError('NOT_FOUND', '找不到这条改进项。');
      item.completed = completed; a.version++; write(db);
    },
    answer(id: string, reviewId: string, questionId: string, answer: string, version: number) {
      if (!answer.trim()) throw new PracticeError('VALIDATION', '请填写回答后再保存。');
      const db = read(), a = selected(find(db, id), reviewId); checkVersion(a.version, version);
      const question = a.result?.followups.find(q => q.id === questionId);
      if (!question) throw new PracticeError('NOT_FOUND', '找不到这条追问。');
      question.answer = answer; a.version++; write(db);
    },
    statistics(days: 7 | 30): CodeStatistics {
      const db = read(), dates = Array.from({ length: days }, (_, i) => new Date(clock() + 8 * 3600000 - (days - 1 - i) * 86400000).toISOString().slice(0, 10));
      const dateOf = (s: Submission) => new Date(Date.parse(s.createdAt) + 8 * 3600000).toISOString().slice(0, 10);
      const rows = db.submissions.filter(s => dates.includes(dateOf(s)));
      const scores = (items: Submission[]) => items.flatMap(s => { const a = selected(s); return a.status === 'succeeded' && a.result?.score != null ? [a.result.score] : []; });
      const mean = (v: number[]) => v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null;
      const valid = scores(rows), improvements = rows.flatMap(s => selected(s).result?.improvements ?? []);
      return clone({ days, submissions: rows.length, scored: valid.length, average: mean(valid), highest: valid.length ? Math.max(...valid) : null,
        improved: improvements.filter(i => i.completed).length, improvements: improvements.length,
        points: dates.map(date => { const items = rows.filter(s => dateOf(s) === date), tested = items.filter(s => s.input.testStatus === 'provided');
          const total = tested.reduce((n, s) => n + Number(s.input.total), 0), passed = tested.reduce((n, s) => n + Number(s.input.passed), 0);
          return { date, average: mean(scores(items)), selftest: total ? Math.round(passed / total * 1000) / 10 : null, count: items.length }; }),
        recent: [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5) });
    },
  };
}
export type PracticeAdapter = ReturnType<typeof createMockPractice>;
