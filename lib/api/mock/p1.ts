import type {
  AuthUser, ProfileResponse, JobTarget, Consent, RouteDetail, TaskOut, TodayItem,
  NotificationChannel, NotificationPreference, OutboxItem, ImportPreview,
} from '../live';

/** Local preview adapter only. No fetch, cookies, AI, code execution or external notifications. */
export const MOCK_STORAGE_KEY = 'persistlog:mock:p1:v1';
type ImportRecord = Omit<ImportPreview, 'route'> & { job_id: string; route: RouteDetail };
type Database = {
  version: 1; session: boolean; user: AuthUser; profile: ProfileResponse;
  targets: JobTarget[]; consents: Consent[]; routes: RouteDetail[]; items: TodayItem[];
  channels: NotificationChannel[]; preferences: NotificationPreference[]; outbox: OutboxItem[];
  imports: ImportRecord[];
};
let memory: Database | undefined;
const stamp = () => new Date().toISOString();
const id = () => `mock-${crypto.randomUUID()}`;
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const day = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const after = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
type Body = Record<string, unknown>;
function object(value: unknown): Body {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Body : {};
}
function required(value: unknown, name: string) {
  if (typeof value !== 'string' || !value.trim()) fail(422, 'VALIDATION_ERROR', `请填写${name}`);
  return value as string;
}
function minutes(value: unknown, fallback = 30) {
  const n = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 1440) fail(422, 'VALIDATION_ERROR', '分钟数需在 1–1440 之间');
  return Math.round(n);
}
class MockFailure extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
function fail(status: number, code: string, message: string): never { throw new MockFailure(status, code, message); }
function found<T>(value: T | undefined): T {
  if (!value) fail(404, 'NOT_FOUND', '演示记录不存在，请刷新或重置演示数据');
  return value;
}
function task(title: string, duration: number, date: string): TaskOut {
  return {
    id: id(), title, description: '', learning_objective: '', task_type: 'engineering',
    priority: 'P1', difficulty: null, estimated_minutes: duration, planned_date: date, due_date: null,
    deliverable: '一页方案说明（演示）', acceptance_criteria: '说明方案取舍与边界', resources: [],
    capability_tags: [], needs_review: false, is_splittable: true, source_type: 'manual',
    source_id: null, status: 'active', created_at: stamp(),
  };
}
function occurrence(t: TaskOut, date: string): TodayItem {
  return {
    id: id(), task_id: t.id, occurrence_date: date, status: 'pending', planned_minutes: t.estimated_minutes,
    actual_minutes: null, remaining_minutes: t.estimated_minutes, carry_over_from_id: null, postpone_count: 0,
    skip_reason: null, block_reason: null, note: null, started_at: null, completed_at: null, split_index: 0,
    parent_occurrence_id: null, title: t.title, task_type: t.task_type, stage_name: '基础与实践',
    week_focus: '本周目标', source_type: t.source_type, why: 'Mock 演示任务，不关联真实计划',
    is_optional: false, carry_over: false,
  };
}
function route(title: string, date: string, tasks: TaskOut[] = []): RouteDetail {
  return {
    id: id(), job_target_id: 'mock-target', title, status: 'draft', start_date: date,
    end_date: after(date, 21), forecast_end_date: after(date, 7), daily_capacity_minutes: 240,
    current_version: 1, created_at: stamp(), description: 'Mock 演示路线', source_type: 'manual',
    progress: { total_tasks: tasks.length, completed_tasks: 0, percent: 0 },
    stages: tasks.length ? [{ id: id(), name: '基础与实践', objective: '', order_no: 1, start_date: date,
      end_date: after(date, 7), weight: 1, exit_criteria: '', weeks: [{ id: id(), week_no: 1,
        focus: '本周目标', milestone: '', start_date: date, end_date: after(date, 7), tasks }] }] : [],
  };
}
function seed(): Database {
  const date = day();
  const user: AuthUser = { id: 'mock-user', email: 'demo@persistlog.test', display_name: '演示同学', timezone: 'Asia/Shanghai', status: 'active', created_at: stamp() };
  const tasks = [task('梳理 HTTP 缓存流程', 45, date), task('完成订单缓存方案', 70, date), task('整理今日复盘', 25, date)];
  const primary = route('后端工程练习（演示）', date, tasks);
  primary.status = 'active';
  const items = tasks.map(t => occurrence(t, date));
  Object.assign(items[0], { status: 'completed', actual_minutes: 40, remaining_minutes: 0, completed_at: stamp() });
  return {
    version: 1, session: false, user,
    profile: { user, education: '本科', major: '计算机', graduation_year: null, work_years: 0,
      tech_stack: ['Java', 'Redis'], daily_available_minutes: 300, planning_capacity_factor: 0.8,
      day_boundary_time: '04:00:00', preferred_start_time: null, preferred_end_time: null, bio: null },
    targets: [{ id: 'mock-target', title: 'Java 后端实习（演示）', city: null, industry: null, company_type: null,
      target_date: after(date, 21), priority: 'P0', is_primary: true, status: 'active', created_at: stamp() }],
    consents: [], routes: [primary], items, channels: [], preferences: [], outbox: [], imports: [],
  };
}
function db() {
  if (memory) return memory;
  if (typeof window !== 'undefined') {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(MOCK_STORAGE_KEY) ?? 'null');
      if (saved?.version === 1 && Array.isArray(saved.routes) && Array.isArray(saved.items) && saved.profile && saved.user) memory = saved;
    } catch { /* corrupt/disabled preview storage: start with a clean demo */ }
  }
  return memory ??= seed();
}
function persist(state: Database) {
  if (typeof window !== 'undefined') {
    try { window.sessionStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(state)); }
    catch { fail(507, 'MOCK_STORAGE_UNAVAILABLE', '浏览器禁止保存演示数据；请允许此站点会话存储后重试'); }
  }
}
export function resetMockData() {
  memory = seed();
  persist(memory);
}
function progress(tasks: TaskOut[], state: Database) {
  const completed = new Set(state.items.filter(i => i.status === 'completed').map(i => i.task_id));
  const done = tasks.filter(t => completed.has(t.id)).length;
  return { total_tasks: tasks.length, completed_tasks: done, percent: tasks.length ? Math.round(done / tasks.length * 100) : 0 };
}
function sync(state: Database) {
  for (const r of state.routes) {
    for (const s of r.stages) {
      for (const w of s.weeks) w.progress = progress(w.tasks, state);
      s.progress = progress(s.weeks.flatMap(w => w.tasks), state);
    }
    r.progress = progress(r.stages.flatMap(s => s.weeks.flatMap(w => w.tasks)), state);
  }
  state.profile.user = state.user;
}
function today(state: Database, date: string) {
  const items = state.items.filter(i => i.occurrence_date === date);
  const counted = items.filter(i => i.status !== 'abandoned');
  const done = counted.filter(i => i.status === 'completed');
  return { plan_id: `mock-plan-${date}`, date, timezone: state.user.timezone,
    capacity_minutes: Math.round(state.profile.daily_available_minutes * state.profile.planning_capacity_factor),
    summary: { planned_tasks: counted.length, completed_tasks: done.length,
      planned_minutes: counted.reduce((n, i) => n + i.planned_minutes, 0), actual_minutes: counted.reduce((n, i) => n + (i.actual_minutes ?? 0), 0),
      completion_rate: counted.length ? done.length / counted.length : 0 }, items, carry_over: [] };
}
function importStats(r: RouteDetail) {
  const tasks = r.stages.flatMap(s => s.weeks.flatMap(w => w.tasks));
  return { stages: r.stages.length, weeks: r.stages.reduce((n, s) => n + s.weeks.length, 0), tasks: tasks.length, total_minutes: tasks.reduce((n, t) => n + t.estimated_minutes, 0) };
}
function forecast(state: Database) {
  const completed = new Set(state.items.filter(i => i.status === 'completed').map(i => i.task_id));
  const remaining = state.routes.filter(r => r.status === 'active').flatMap(r => r.stages.flatMap(s => s.weeks.flatMap(w => w.tasks))).filter(t => !completed.has(t.id)).reduce((n, t) => n + t.estimated_minutes, 0);
  const capacity = Math.max(1, Math.round(state.profile.daily_available_minutes * state.profile.planning_capacity_factor));
  return { generated_at: stamp(), timezone: state.user.timezone, remaining_minutes: remaining, throughput_minutes: capacity,
    forecast_days: Math.ceil(remaining / capacity), forecast_end_date: after(day(), Math.ceil(remaining / capacity)),
    routes: state.routes.filter(r => r.status === 'active').map(r => ({ route_id: r.id, title: r.title,
      target_date: state.targets[0]?.target_date ?? null, forecast_end_date: r.forecast_end_date, remaining_minutes: remaining })) };
}
async function dispatch(path: string, init: RequestInit, state: Database): Promise<unknown> {
  const url = new URL(path, 'http://mock.invalid');
  const p = url.pathname;
  const method = (init.method ?? 'GET').toUpperCase();
  const b = typeof init.body === 'string' ? object(JSON.parse(init.body)) : {};
  const date = url.searchParams.get('date') ?? day();
  if (method === 'POST' && ['/auth/login', '/auth/register'].includes(p)) {
    required(b.email, '演示邮箱'); required(b.password, '演示密码');
    // One isolated demo identity. Never persist passwords, real emails or auth tokens.
    if (p === '/auth/register') Object.assign(state, seed());
    state.session = true;
    return { access_token: 'mock-session', token_type: 'bearer', expires_in: 3600, user: state.user };
  }
  if (!state.session) fail(401, 'UNAUTHENTICATED', '请先进入演示账户');
  if (p === '/auth/refresh' && method === 'POST') return { access_token: 'mock-session' };
  if (p === '/auth/me' && method === 'GET') return state.user;
  if (p === '/auth/logout' && method === 'POST') { state.session = false; return null; }
  if (p === '/profile') {
    if (method === 'PUT') {
      if (b.daily_available_minutes !== undefined) b.daily_available_minutes = minutes(b.daily_available_minutes);
      if (b.planning_capacity_factor !== undefined && !(Number(b.planning_capacity_factor) > 0 && Number(b.planning_capacity_factor) <= 1)) fail(422, 'VALIDATION_ERROR', '容量系数需在 0–1 之间');
      Object.assign(state.profile, b);
      if (b.display_name) state.user.display_name = String(b.display_name);
      if (b.timezone) state.user.timezone = String(b.timezone);
      sync(state);
    }
    if (['GET', 'PUT'].includes(method)) return state.profile;
  }
  if (p === '/settings' && method === 'GET') return {};
  if (p === '/job-targets' && method === 'GET') return state.targets;
  if (p === '/job-targets' && method === 'POST') {
    const item = { ...state.targets[0], ...b, id: id(), title: required(b.title, '目标'), created_at: stamp() } as JobTarget;
    if (item.is_primary) state.targets.forEach(t => t.is_primary = false);
    state.targets.push(item); return item;
  }
  if (p.startsWith('/job-targets/') && method === 'PATCH') return Object.assign(found(state.targets.find(t => t.id === p.split('/')[2])), b);
  if (p === '/consents' && method === 'GET') return state.consents;
  if (p === '/consents' && method === 'PUT') {
    const consent = { scope: required(b.scope, '授权范围'), version: String(b.version ?? 'v1'), granted_at: b.granted ? stamp() : null, revoked_at: b.granted ? null : stamp() } as Consent;
    state.consents = [...state.consents.filter(c => c.scope !== consent.scope), consent]; return consent;
  }
  if ((p === '/today' && method === 'GET') || (p === '/today/generate' && method === 'POST')) return today(state, date);
  if (p === '/today/items' && method === 'POST') {
    const t = task(required(b.title, '任务标题'), minutes(b.estimated_minutes), date);
    t.task_type = String(b.task_type ?? 'engineering');
    const item = occurrence(t, date); item.note = String(b.note ?? ''); state.items.push(item);
    return today(state, date);
  }
  const action = p.match(/^\/task-occurrences\/([^/]+)\/([^/]+)$/);
  if (action && method === 'POST') {
    const item = found(state.items.find(i => i.id === action[1]));
    const target = { start: 'in_progress', complete: 'completed', postpone: 'postponed', skip: 'skipped', block: 'blocked', unblock: 'pending', abandon: 'abandoned' } as const;
    const name = action[2] as keyof typeof target;
    if (name in target) {
      item.status = target[name];
      if (name === 'complete') { item.actual_minutes = Number(b.actual_minutes ?? item.planned_minutes); item.completed_at = stamp(); item.remaining_minutes = 0; }
      if (name === 'start') item.started_at = stamp();
      if (name === 'block') item.block_reason = required(b.reason, '阻塞原因');
      if (name === 'skip') item.skip_reason = required(b.reason, '跳过原因');
      if (name === 'unblock') item.block_reason = null;
      if (b.note) item.note = String(b.note);
      if (name === 'postpone') {
        const next = copy(item); Object.assign(next, { id: id(), status: 'pending', occurrence_date: after(item.occurrence_date, 1), carry_over: true, carry_over_from_id: item.id, postpone_count: item.postpone_count + 1 }); state.items.push(next);
      }
      sync(state); return item;
    }
    if (action[2] === 'split') {
      const n = Number(b.parts ?? 2); if (!Number.isInteger(n) || n < 2 || n > 4) fail(422, 'VALIDATION_ERROR', '拆分数量需为 2–4');
      item.status = 'abandoned';
      const children = Array.from({ length: n }, (_, i) => ({ ...copy(item), id: id(), status: 'pending' as const,
        planned_minutes: Math.floor(item.planned_minutes / n) + (i < item.planned_minutes % n ? 1 : 0),
        actual_minutes: null, parent_occurrence_id: item.id, split_index: i + 1, title: `${item.title} · ${i + 1}` }));
      state.items.push(...children); return children;
    }
  }
  if (p === '/routes' && method === 'GET') return state.routes.filter(r => !url.searchParams.get('status') || r.status === url.searchParams.get('status'));
  if (p === '/routes' && method === 'POST') {
    const r = route(required(b.title, '路线名称'), String(b.start_date ?? date)); r.daily_capacity_minutes = minutes(b.daily_capacity_minutes, 240); state.routes.push(r); return r;
  }
  const matchRoute = p.match(/^\/routes\/([^/]+)(?:\/([^/]+))?$/);
  if (matchRoute) {
    const r = found(state.routes.find(r => r.id === matchRoute[1])); const op = matchRoute[2];
    if (!op && method === 'GET') return r;
    if (!op && method === 'PATCH') return Object.assign(r, b);
    if (op === 'forecast' && method === 'GET') return { ...forecast(state), route_id: r.id, target_date: state.targets[0]?.target_date };
    if (op === 'versions' && method === 'GET') return [{ version_no: r.current_version, created_at: stamp(), snapshot: copy(r) }];
    if (method === 'POST' && ['activate', 'pause', 'resume', 'archive', 'adjust'].includes(op)) {
      if (op === 'adjust') { if (b.start_date) r.start_date = String(b.start_date); r.daily_capacity_minutes = minutes(b.daily_capacity_minutes, r.daily_capacity_minutes); r.current_version++; }
      else r.status = ({ activate: 'active', pause: 'paused', resume: 'active', archive: 'archived' } as Record<string, string>)[op];
      return r;
    }
  }
  if (p.startsWith('/dashboard/') && method === 'GET') {
    const days = url.searchParams.get('days') === '30' ? 30 : 7;
    const dates = Array.from({ length: days }, (_, i) => after(day(), i - days + 1));
    const selected = state.items.filter(i => dates.includes(i.occurrence_date) && i.status !== 'abandoned');
    const common = { start_date: dates[0], end_date: day(), timezone: state.user.timezone };
    const summary = { planned_tasks: selected.length, completed_tasks: selected.filter(i => i.status === 'completed').length,
      planned_minutes: selected.reduce((n, i) => n + i.planned_minutes, 0), actual_minutes: selected.reduce((n, i) => n + (i.actual_minutes ?? 0), 0), carry_over_count: selected.filter(i => i.carry_over).length };
    if (p.endsWith('/overview')) return { ...common, ...summary, completion_rate: selected.length ? summary.completed_tasks / selected.length : 0,
      carry_over_rate: selected.length ? summary.carry_over_count / selected.length : 0, active_routes: state.routes.filter(r => r.status === 'active').length, route_progress: state.routes[0]?.progress ?? { total_tasks: 0, completed_tasks: 0, percent: 0 } };
    if (p.endsWith('/trends')) return { ...common, points: dates.map(d => ({ ...today(state, d).summary, date: d, carry_over_count: selected.filter(i => i.occurrence_date === d && i.carry_over).length })) };
    if (p.endsWith('/distribution')) {
      const buckets = (key: 'status' | 'task_type') => [...new Set(selected.map(i => i[key]))].map(value => { const group = selected.filter(i => i[key] === value); return { key: value, label: value === 'engineering' ? '工程' : value, planned_tasks: group.length, completed_tasks: group.filter(i => i.status === 'completed').length, planned_minutes: group.reduce((n, i) => n + i.planned_minutes, 0), actual_minutes: group.reduce((n, i) => n + (i.actual_minutes ?? 0), 0) }; });
      return { ...common, by_status: buckets('status'), by_task_type: buckets('task_type'), by_route: [], by_priority: [] };
    }
    if (p.endsWith('/forecast')) return forecast(state);
  }
  if (p === '/imports' && method === 'GET') return state.imports;
  if (p === '/imports' && method === 'POST') {
    if (!state.consents.some(c => c.scope === 'ai_import' && c.granted_at && !c.revoked_at)) fail(403, 'CONSENT_REQUIRED', '请先确认演示导入授权');
    const file = init.body instanceof FormData ? init.body.get('file') : null;
    if (!(file instanceof Blob) || file.size > 5 * 1024 * 1024) fail(422, 'VALIDATION_ERROR', '请选择不超过 5 MB 的 Markdown 文件');
    const r = route('导入路线（固定示例，不解析文件）', date, [task('检查导入后的任务结构', 30, date), task('完成示例任务产出', 45, date)]);
    const item: ImportRecord = { import_id: id(), job_id: id(), status: 'preview', route: r,
      assumptions: ['Mock 返回固定预览，不调用 AI、不解析文件内容'], warnings: [], issues: [], stats: importStats(r), file_name: '演示计划.md', created_at: stamp(), route_id: null };
    state.imports.push(item); return { import_id: item.import_id, job_id: item.job_id, status: 'succeeded' };
  }
  if (p.startsWith('/jobs/') && method === 'GET') {
    const item = found(state.imports.find(i => i.job_id === p.split('/')[2]));
    return { id: item.job_id, job_type: 'import', status: item.status === 'cancelled' ? 'cancelled' : 'succeeded', progress: 1, result_ref: item.import_id, error: null, created_at: item.created_at, updated_at: stamp() };
  }
  const imp = p.match(/^\/imports\/([^/]+)(?:\/([^/]+))?$/);
  if (imp) {
    const item = found(state.imports.find(i => i.import_id === imp[1])); const op = imp[2];
    if (method === 'GET' && (!op || op === 'preview')) return item;
    if (method === 'PATCH' && op === 'preview') { item.route = copy(object(b.route)) as unknown as RouteDetail; item.stats = importStats(item.route); return item; }
    if (method === 'POST' && op === 'confirm') {
      if (item.status === 'cancelled' || item.status === 'rolled_back') fail(409, 'STATE_CONFLICT', '此演示导入已取消或回滚');
      if (!item.route_id) { item.route.status = 'active'; state.routes.push(copy(item.route)); item.route_id = item.route.id;
        state.items.push(...item.route.stages.flatMap(s => s.weeks.flatMap(w => w.tasks.map(t => occurrence(t, date))))); }
      item.status = 'confirmed'; sync(state);
      return { route_id: item.route_id, status: 'confirmed', created_tasks: item.stats.tasks };
    }
    if (method === 'POST' && ['cancel', 'rollback'].includes(op)) {
      if (op === 'cancel' && item.route_id) fail(409, 'STATE_CONFLICT', '已确认的导入需要回滚');
      const taskIds = item.route.stages.flatMap(s => s.weeks.flatMap(w => w.tasks.map(t => t.id)));
      if (state.items.some(i => taskIds.includes(i.task_id) && i.status !== 'pending')) fail(409, 'STATE_CONFLICT', '已有执行记录，不能回滚');
      state.routes = state.routes.filter(r => r.id !== item.route_id); state.items = state.items.filter(i => !taskIds.includes(i.task_id));
      item.status = op === 'cancel' ? 'cancelled' : 'rolled_back'; return item;
    }
  }
  if (p === '/notification-channels' && method === 'GET') return state.channels;
  if (p === '/notification-channels' && method === 'POST') {
    const channel: NotificationChannel = { id: id(), name: String(b.name ?? '演示渠道'), channel_type: 'wecom', webhook_masked: '演示地址（未连接企微）', status: 'active', quiet_hours: null, last_test_at: null, last_error: null, created_at: stamp() };
    state.channels.push(channel); return channel;
  }
  const channelMatch = p.match(/^\/notification-channels\/([^/]+)(?:\/(test))?$/);
  if (channelMatch) {
    const c = found(state.channels.find(c => c.id === channelMatch[1]));
    if (method === 'PATCH') { if (b.name) c.name = String(b.name); c.quiet_hours = b.quiet_hours as NotificationChannel['quiet_hours'] ?? c.quiet_hours; return c; }
    if (method === 'DELETE') { state.channels = state.channels.filter(i => i.id !== c.id); state.preferences = state.preferences.filter(i => i.channel_id !== c.id); return null; }
    if (method === 'POST' && channelMatch[2]) { c.last_test_at = stamp(); state.outbox.unshift({ id: id(), event_type: 'test', status: 'sent', attempts: 1, last_error: null, created_at: stamp(), sent_at: stamp() }); return { simulated: true, message: '仅模拟发送，未连接企微' }; }
  }
  if (p === '/notification-preferences' && method === 'GET') return state.preferences;
  if (p === '/notification-preferences' && method === 'PUT') { state.preferences = (Array.isArray(b.items) ? b.items : []).map(value => ({ ...object(value), id: id() })) as unknown as NotificationPreference[]; return state.preferences; }
  if (p === '/notification-outbox' && method === 'GET') return state.outbox;
  if (p === '/notification-templates' && method === 'GET') return [];
  if (/^\/notification-outbox\/[^/]+\/resend$/.test(p) && method === 'POST') { const item = found(state.outbox.find(i => i.id === p.split('/')[2])); item.attempts++; item.status = 'sent'; item.sent_at = stamp(); return { simulated: true }; }
  fail(501, 'MOCK_NOT_IMPLEMENTED', `演示适配器暂不支持 ${method} ${p}；不会转发到真实接口`);
}

async function execute(path: string, init: RequestInit): Promise<Response> {
  if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const state = db();
  // Commit mutations only after a successful operation; failed writes keep the previous demo state.
  const next = copy(state);
  try {
    sync(next);
    const result = await dispatch(path, init, next);
    if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    persist(next); memory = next;
    return Response.json(result);
  } catch (error) {
    if (!(error instanceof MockFailure)) throw error;
    return Response.json({ error: { code: error.code, message: error.message, request_id: 'mock-local' } }, { status: error.status });
  }
}

// Serialize preview writes/reads so Promise.all and rapid task actions cannot lose updates.
let queue: Promise<unknown> = Promise.resolve();
export function mockRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const result = queue.then(() => execute(path, init));
  queue = result.catch(() => undefined);
  return result;
}
