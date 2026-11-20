"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, PageHeader } from '@/components/ui';
import { useAppStore } from '@/lib/store/app-store';
import { live } from '@/lib/api/live';
import { EMPTY_INPUT, LANGUAGES, PracticeError, type SubmissionInput } from '@/lib/practice/types';
import { MAX_CODE_BYTES, validateSubmission } from '@/lib/practice/validation';
import { withPractice } from '@/lib/practice/service';
import { usePracticeResource } from '@/lib/practice/use-resource';
import { DemoNotice, ErrorNotice, PracticeBoundary } from './common';
import styles from './practice.module.css';

type Props = { copyId?: string; taskId?: string; routeId?: string; preset?: boolean };
export function SubmissionForm(props: Props) { return <PracticeBoundary><LoadForm {...props} /></PracticeBoundary>; }
function LoadForm({ copyId, taskId, routeId, preset }: Props) {
  const { tasks, loading: taskLoading } = useAppStore();
  const load = useCallback(async (signal: AbortSignal) => {
    const [practice, route] = await Promise.all([withPractice(async api => ({ draft: await api.draft(), original: copyId ? (await api.detail(copyId)).submission : null }), signal), routeId ? live.routes.get(routeId) : null]);
    return { ...practice, route };
  }, [copyId, routeId]);
  const { data, error, loading, refresh } = usePracticeResource(load, undefined, false);
  const routeTask = data?.route?.stages.flatMap(s => s.weeks.flatMap(w => w.tasks)).find(t => t.id === taskId);
  const task = routeTask ? { id: routeTask.id, taskId: routeTask.id, title: routeTask.title, source: '学习路线', stage: data?.route?.title ?? '' } : taskId ? tasks.find(t => t.id === taskId || t.taskId === taskId) : null;
  if (error) return <ErrorNotice message={error} retry={refresh} />;
  if (loading || !data || (taskId && taskLoading)) return <div className={styles.card} aria-busy="true">正在恢复草稿与任务信息…</div>;
  if (taskId && !task) return <ErrorNotice message="没有找到关联的今日任务，请从今日页重新进入。" />;
  const matchingDraft = data.draft && (copyId ? data.draft.input.originSubmissionId === copyId : task ? data.draft.input.taskId === (task.taskId ?? task.id) : true);
  const initial = matchingDraft ? data.draft!.input : data.original ? { ...data.original.input, independent: false, consent: false, originSubmissionId: copyId } : task ? { ...EMPTY_INPUT, title: task.title, taskId: task.taskId ?? task.id, source: task.source + ' · ' + task.stage } : { ...EMPTY_INPUT, ...(preset ? { title: '实现支持过期时间的 LRU 缓存', difficulty: '中等', source: '学习路线 · 第 3 阶段（演示）', tags: '缓存, 数据结构' } : {}) };
  return <Editor key={(copyId ?? '') + (taskId ?? '') + (data.draft?.id ?? 'new')} initial={initial} version={data.draft?.version ?? 0} parentId={initial.originSubmissionId} replacing={!!data.draft && !matchingDraft} />;
}
function Editor({ initial, version, parentId, replacing }: { initial: SubmissionInput; version: number; parentId?: string; replacing: boolean }) {
  const router = useRouter();
  const [input, setInput] = useState<SubmissionInput>(initial);
  const [draftVersion, setDraftVersion] = useState(version);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(version ? '已恢复当前标签页草稿。' : '');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const lock = useRef(false), key = useRef(''), fileSequence = useRef(0);
  useEffect(() => {
    function leave(e: BeforeUnloadEvent) { if (dirty) { e.preventDefault(); e.returnValue = ''; } }
    window.addEventListener('beforeunload', leave);
    return () => { window.removeEventListener('beforeunload', leave); };
  }, [dirty]);
  useEffect(() => { const gate = fileSequence; return () => { gate.current++; }; }, []);
  function change<K extends keyof SubmissionInput>(name: K, value: SubmissionInput[K]) {
    setInput(s => ({ ...s, [name]: value })); setErrors(s => ({ ...s, [name]: '' })); setDirty(true); key.current = ''; setNotice('');
  }
  function report(cause: unknown) { setError(cause instanceof Error ? cause.message : '操作失败，请重试。'); if (cause instanceof PracticeError) setErrors(cause.fields); }
  async function save() {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { const draft = await withPractice(api => api.saveDraft(input, draftVersion)); setDraftVersion(draft.version); setDirty(false); setNotice('演示草稿已保存，刷新可恢复。'); }
    catch (cause) { report(cause); } finally { lock.current = false; setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (lock.current || reading) return;
    const fields = validateSubmission(input); setErrors(fields); setError('');
    if (Object.keys(fields).length) { setError('请修正标出的字段后再提交。'); return; }
    lock.current = true; setBusy(true); key.current ||= crypto.randomUUID();
    try { const id = await withPractice(api => api.submit(input, key.current, draftVersion, parentId)); setDirty(false); router.push('/practice/' + id); }
    catch (cause) { report(cause); lock.current = false; setBusy(false); }
  }
  async function readFile(file?: File) {
    if (!file) return;
    if (!/\.(py|java|js|ts|txt)$/i.test(file.name) || file.size > MAX_CODE_BYTES) { setErrors(s => ({ ...s, code: '请选择不超过 200 KiB 的 py/java/js/ts/txt 文本文件。' })); return; }
    if (input.code && !window.confirm('用所选文件替换当前编辑区代码？其他字段不变。')) return;
    const seq = ++fileSequence.current; setReading(true);
    try {
      const code = await file.text(); if (seq !== fileSequence.current) return;
      if (code.includes('\0') || new TextEncoder().encode(code).byteLength > MAX_CODE_BYTES) throw new Error('文件不是有效文本代码，或内容超过 200 KiB。');
      const extension = file.name.split('.').pop()?.toLowerCase();
      const language = ({ py: 'Python 3.11', java: 'Java 17', js: 'JavaScript', ts: 'TypeScript' } as Record<string, SubmissionInput['language']>)[extension ?? ''] ?? input.language;
      setInput(s => ({ ...s, code, fileName: file.name, language })); setDirty(true); key.current = ''; setErrors(s => ({ ...s, code: '', fileName: '' }));
    } catch (cause) { report(cause); } finally { if (seq === fileSequence.current) setReading(false); }
  }
  function field(name: keyof SubmissionInput, label: string, multiline = false) {
    const props = { id: 'practice-' + name, value: String(input[name] ?? ''), disabled: busy || reading,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => change(name, e.target.value),
      'aria-invalid': !!errors[name], 'aria-describedby': errors[name] ? 'error-' + name : undefined };
    return <div className={styles.field}><label htmlFor={props.id}>{label}</label>{multiline ? <textarea {...props} /> : <input {...props} />}<FieldError name={name} message={errors[name]} /></div>;
  }
  return <div className="view"><div className={styles.page}><PageHeader title="提交代码" description="提交后进入独立评审页；代码快照不可修改，后续修改会形成新提交。" side={<Link className="btn btn--secondary" href="/practice" onClick={e => { if (dirty && !window.confirm('尚有未保存修改，仍返回历史？')) e.preventDefault(); }}>返回提交历史</Link>} /><DemoNotice />
    {replacing && <p className={styles.notice}>当前是新建副本。保存或提交会替换本标签页已有草稿，原提交不受影响。</p>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}{error && <ErrorNotice message={error} />}
    {error && <Button onClick={async () => {
      if (!window.confirm('重新读取最新草稿版本？当前编辑内容保留，再次保存将以当前内容覆盖新版本。')) return;
      try { const d = await withPractice(api => api.draft()); setDraftVersion(d?.version ?? 0); key.current = ''; setError(''); setNotice('已读取最新版本号，当前输入保留；请确认后保存。'); } catch (e) { report(e); }
    }}>保留输入并重新读取版本</Button>}
    <form onSubmit={submit} noValidate className={styles.page}>
      <section className={styles.card}><div className={styles.head}><div><h2>练习信息</h2><p>题目与说明会一同进入这次快照。</p></div></div><div className={styles.fields}>
        {field('title', '题目名称')}
        <div className={styles.field}><label htmlFor="practice-language">语言</label><select id="practice-language" disabled={busy || reading} value={input.language} onChange={e => change('language', e.target.value as SubmissionInput['language'])}>{LANGUAGES.map(x => <option key={x}>{x}</option>)}</select></div>
        <div className={styles.field}><label htmlFor="practice-difficulty">难度</label><select id="practice-difficulty" disabled={busy} value={input.difficulty} onChange={e => change('difficulty', e.target.value)}>{['未标记', '简单', '中等', '困难'].map(x => <option key={x}>{x}</option>)}</select></div>
        {field('source', '来源说明')}{field('tags', '标签（逗号分隔，最多 10 个）')}{field('fileName', '代码文件名')}
        {field('timeComplexity', '自己判断的时间复杂度')}{field('spaceComplexity', '自己判断的空间复杂度')}
        <div className={styles.full}>{field('notes', '思路说明（可选）', true)}</div>
      </div></section>
      <section className={styles.card}><div className={styles.head}><h2>代码</h2><span className={styles.muted}>{new TextEncoder().encode(input.code).byteLength} / {MAX_CODE_BYTES} 字节</span></div>
        <div className={styles.field}><label htmlFor="practice-code">粘贴代码</label><textarea id="practice-code" className={styles.editor} spellCheck={false} value={input.code} disabled={busy || reading} aria-invalid={!!errors.code} aria-describedby="error-code" onChange={e => change('code', e.target.value)} /><FieldError name="code" message={errors.code} /></div>
        <div className={styles.field}><label htmlFor="practice-file">或选择文本代码文件（最大 200 KiB）</label><input id="practice-file" type="file" accept=".py,.java,.js,.ts,.txt" disabled={busy || reading} onChange={e => { void readFile(e.target.files?.[0]); e.target.value = ''; }} />{reading && <p role="status">正在本地读取文件…</p>}</div>
      </section>
      <section className={styles.card}><div className={styles.head}><div><h2>自测与确认</h2><p>自测为用户声明，不是系统判题；尚未自测时不评定正确性、总分和等级。</p></div></div>
        <div className={styles.field}><label htmlFor="test-status">自测情况</label><select id="test-status" value={input.testStatus} disabled={busy} onChange={e => change('testStatus', e.target.value as SubmissionInput['testStatus'])}><option value="provided">已填写自测结果</option><option value="untested">尚未自测</option></select></div>
        {input.testStatus === 'provided' && <div className={styles.fields}>{field('passed', '通过用例数')}{field('total', '总用例数')}<div className={styles.full}>{field('failedTest', '失败用例（可选）', true)}</div></div>}
        <label className={styles.check}><input type="checkbox" checked={input.independent} disabled={busy} onChange={e => change('independent', e.target.checked)} />本次代码由我本人独立完成</label><FieldError name="independent" message={errors.independent} />
        <label className={styles.check}><input type="checkbox" checked={input.consent} disabled={busy} onChange={e => change('consent', e.target.checked)} />我确认演示静态评审用途：代码和说明仅保存在本标签页。本轮不会发送给第三方 AI。</label><FieldError name="consent" message={errors.consent} />
      </section>
      <div className={styles.footer}><span className={styles.muted}>不执行代码 · 不提供 AC 判定 · 不测运行时间与内存</span><div className={styles.actions}>
        <Button disabled={busy || reading} onClick={save}>保存草稿</Button>
        {draftVersion > 0 && <Button disabled={busy} onClick={async () => { if (!window.confirm('删除已保存的演示草稿？当前编辑区仍保留。')) return; try { await withPractice(api => api.deleteDraft(draftVersion)); setDraftVersion(0); setDirty(true); setNotice('已删除保存的草稿，编辑区内容仍保留。'); } catch (e) { report(e); } }}>删除草稿</Button>}
        <Button type="submit" variant="primary" disabled={busy || reading}>{busy ? '保存中…' : '提交并开始演示评审'}</Button>
      </div></div>
    </form>
  </div></div>;
}
function FieldError({ name, message }: { name: string; message?: string }) { return <p id={'error-' + name} className={styles.fieldError} role={message ? 'alert' : undefined}>{message ?? ''}</p>; }
