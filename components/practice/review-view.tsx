"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, PageHeader } from '@/components/ui';
import { withPractice } from '@/lib/practice/service';
import { usePracticeResource } from '@/lib/practice/use-resource';
import type { Followup, ReviewDetail, PracticeOverview } from '@/lib/practice/types';
import { DemoNotice, ErrorNotice, PracticeBoundary, Status, SubmissionHistory, dateLabel } from './common';
import { ReviewProgress } from './review-progress';
import styles from './practice.module.css';

type ReviewData = { detail: ReviewDetail; history: PracticeOverview['history'] };
const processing = (data: ReviewData) => ['pending', 'reviewing'].includes(data.detail.latest.status);
export function ReviewView(props: { submissionId: string; reviewId?: string }) { return <PracticeBoundary><Review {...props} /></PracticeBoundary>; }

function Review({ submissionId, reviewId }: { submissionId: string; reviewId?: string }) {
  const router = useRouter();
  const load = useCallback((signal: AbortSignal) => withPractice(async api => ({ detail: await api.detail(submissionId, reviewId), history: (await api.overview()).history.filter(s => s.id !== submissionId) }), signal), [submissionId, reviewId]);
  const { data, error, loading, refresh } = usePracticeResource(load, processing);
  const [actionError, setActionError] = useState(''), [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false), [range, setRange] = useState<[number, number] | null>(null);
  const codeRef = useRef<HTMLPreElement>(null), mutation = useRef(false), retryKey = useRef('');
  async function perform(action: () => Promise<unknown>, message: string) {
    if (mutation.current) return false;
    mutation.current = true; setBusy(true); setActionError(''); setNotice('');
    try { await action(); setNotice(message); refresh(); return true; }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : '保存失败，请重试。'); return false; }
    finally { mutation.current = false; setBusy(false); }
  }
  async function retry() {
    if (mutation.current) return;
    retryKey.current ||= crypto.randomUUID();
    await perform(async () => {
      const id = await withPractice(api => api.retry(submissionId, retryKey.current));
      retryKey.current = ''; router.push('/practice/' + encodeURIComponent(submissionId) + '?review=' + encodeURIComponent(id));
    }, '已追加一条演示评审记录，原快照和旧结果仍保留。');
  }
  function locate(start: number, end: number) {
    setRange([start, end]);
    const line = codeRef.current?.querySelector<HTMLElement>('[data-line="' + start + '"]');
    line?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    line?.focus({ preventScroll: true });
  }
  const detail = data?.detail, a = detail?.selected, sub = detail?.submission, result = a?.result;
  const running = !!detail && ['pending', 'reviewing'].includes(detail.latest.status);
  return <div className="view"><div className={styles.page}>
    <PageHeader title={sub?.input.title ?? '代码评审'} description="保留本次代码快照，按评审版本查看结果和改进依据。" side={<div className={styles.actions}><Link className="btn btn--secondary" href="/practice">返回提交历史</Link><Button disabled={!data || running || busy} onClick={retry}>重新评审</Button></div>} />
    <DemoNotice />
    {error && <ErrorNotice message={error} retry={refresh} />}{actionError && <ErrorNotice message={actionError} retry={refresh} />}{notice && <p role="status" className={styles.notice}>{notice}</p>}
    {!data && loading && <section className={styles.card} aria-busy="true"><div className="skeleton skeleton--hero" /><p>正在读取代码快照与评审记录…</p></section>}
    {data && detail && a && sub && <>
      {a.id !== detail.latest.id && <p className={styles.notice}>正在查看第 {a.number} 次历史评审；最新为第 {detail.latest.number} 次，状态：<Status value={detail.latest.status} /> <Link href={'/practice/' + submissionId}>查看最新结果</Link></p>}
      <ReviewProgress key={a.id} data={detail} refresh={refresh} loading={loading} />
      <div className={styles.workspace}>
        <section className={styles.card + ' ' + styles.codeCard}><div className={styles.head}><div><h2>提交的代码</h2><p>{sub.input.fileName} · {sub.input.language} · 只读快照</p></div><Link className="btn btn--secondary btn--sm" href={'/practice/new?copy=' + encodeURIComponent(sub.id)}>修改并新建提交</Link></div>
          <div className={styles.codeArea}><pre ref={codeRef} className={styles.code} tabIndex={0} aria-label="本次提交的只读代码">{sub.input.code.split('\n').map((line, i) => <span key={i} className={styles.codeLine} data-line={i + 1} data-highlight={!!range && i + 1 >= range[0] && i + 1 <= range[1]} tabIndex={-1}><span className={styles.lineNumber} aria-hidden="true">{i + 1}</span>{line || ' '}{'\n'}</span>)}</pre></div>
          <div className={styles.meta}><span>{sub.input.testStatus === 'provided' ? '自报自测：' + sub.input.passed + '/' + sub.input.total : '尚未自测'}</span><span>时间：{sub.input.timeComplexity}</span><span>空间：{sub.input.spaceComplexity}</span></div>
          <details className={styles.process}><summary>提交时的思路与失败用例</summary><p>{sub.input.notes || '未填写思路说明。'}</p><p>{sub.input.testStatus === 'provided' ? sub.input.failedTest || '未填写失败用例。' : '未提供自测。'}</p></details>
        </section>
        <div className={styles.stack}>
          {['pending', 'reviewing'].includes(a.status) && <section className={styles.card}><h2>评审尚未完成</h2><p className={styles.muted}>代码快照和历史始终可以查看，不需要重复提交。演示结果约 8 秒后生成。</p></section>}
          {a.status === 'failed' && <section className={styles.card}><h2>暂时无法完成评审</h2><ErrorNotice message={a.error ?? '评审失败，原始内容已保留。'} /><div className={styles.actions}><Button variant="primary" disabled={busy || running} onClick={retry}>重试本次评审</Button><Link className="btn btn--secondary" href={'/practice/new?copy=' + sub.id}>返回检查代码</Link></div><p className={styles.muted}>重试追加新评审，不覆盖此条失败记录。</p></section>}
          {result && <>
            <section className={styles.card}><div className={styles.head}><div><h2>评分结果</h2><p>预置静态反馈，不是运行判题结果。</p></div><Status value={a.status} /></div>
              <div className={styles.head}><strong className={styles.score}>{result.score ?? '未评估'}{result.score != null && <small> / 100</small>}</strong><div className={styles.muted}><p>等级：{result.grade ?? '未评定'}</p><p>置信度：{result.confidence}</p><p>静态风险：{result.risk}</p></div></div>
              {a.status === 'insufficient' && <p className={styles.notice}>未提供自测。正确性、总分和等级不评定，不等于 0 分。</p>}
              {result.dimensions.map(d => <div key={d.label} className={styles.dimension}><div><span>{d.label}</span><strong>{d.score == null ? '未评估' : d.score + ' / 100'}</strong></div>{d.score != null && <div className={styles.track} aria-hidden="true"><span style={{ width: d.score + '%' }} /></div>}<p>{d.reason}</p></div>)}
            </section>
            <section className={styles.card}><h2>扣分依据与建议</h2>{result.evidence.map(e => <div key={e.id} className={styles.evidence}><Button size="sm" onClick={() => locate(e.start, e.end)}>{e.fileName} · 第 {e.start}–{e.end} 行</Button><pre>{e.snippet}</pre><p className={styles.muted}>{e.explanation}</p></div>)}</section>
          </>}
        </div>
      </div>
      {result && <>
        <section className={styles.card}><div className={styles.head}><div><h2>改进方向</h2><p>最多三项，完成后由你主动标记。</p></div><span className={styles.muted}>{result.improvements.filter(i => i.completed).length} / {result.improvements.length} 项已标记</span></div>
          <ul className={styles.list}>{result.improvements.map(item => <li className={styles.row} key={item.id}><div><strong>{item.title}</strong><p className={styles.muted}>改法：{item.method}</p><p className={styles.muted}>验证：{item.verification}</p></div><ImprovementCheck completed={item.completed} busy={busy || loading} save={completed => perform(() => withPractice(api => api.improve(sub.id, a.id, item.id, completed, a.version)), '演示改进状态已保存。')} /></li>)}</ul>
        </section>
        <section className={styles.card}><div className={styles.head}><div><h2>复盘追问</h2><p>围绕同一份代码说明你的取舍，保存到当前评审记录。</p></div></div>
          {result.followups.map(q => <Answer key={a.id + q.id} item={q} busy={busy || loading} save={answer => perform(() => withPractice(api => api.answer(sub.id, a.id, q.id, answer, a.version)), '演示追问回答已保存。')} />)}
          <p className={styles.muted}>每日提问属于 P3，本阶段不提供未实现的跳转入口。</p>
        </section>
      </>}
      <section className={styles.card}><div className={styles.head}><div><h2>本次提交的评审记录</h2><p>新旧结果分开保存，点击查看指定版本。</p></div><span className={styles.muted}>{sub.attempts.length} 次</span></div>
        <ol className={styles.list}>{[...sub.attempts].reverse().map(item => <li key={item.id}><Link className={styles.row} href={'/practice/' + sub.id + '?review=' + item.id} aria-current={item.id === a.id ? 'page' : undefined}><div><strong>第 {item.number} 次评审 {item.id === detail.latest.id ? '· 最新' : ''}</strong><small>{dateLabel(item.createdAt)} · {item.error ?? (item.result?.score != null ? item.result.score + ' 分（演示）' : '无评分')}</small></div><Status value={item.status} /></Link></li>)}</ol>
      </section>
      <section className={styles.card}><div className={styles.head}><h2>其他提交历史</h2><Link href="/practice">筛选全部提交 →</Link></div><SubmissionHistory items={data.history} />{!data.history.length && <p className={styles.empty}>没有其他提交。</p>}</section>
    </>}
  </div></div>;
}
function Answer({ item, busy, save }: { item: Followup; busy: boolean; save: (answer: string) => Promise<boolean> }) {
  const [answer, setAnswer] = useState(item.answer), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  return <form className={styles.field} onSubmit={async e => { e.preventDefault(); if (!answer.trim()) { setError('请先填写回答。'); return; } setError(''); if (await save(answer)) setSaved(true); }}>
    <label htmlFor={item.id}>{item.question}</label><textarea id={item.id} value={answer} disabled={busy} aria-invalid={!!error} aria-describedby={'answer-error-' + item.id} onChange={e => { setAnswer(e.target.value); setError(''); setSaved(false); }} />
    <p id={'answer-error-' + item.id} role={error ? 'alert' : undefined} className={styles.fieldError}>{error}</p>
    <div className={styles.actions}><Button size="sm" type="submit" disabled={busy}>保存回答</Button>{saved && <span role="status" className={styles.muted}>已保存到当前演示评审</span>}</div>
  </form>;
}

function ImprovementCheck({ completed, busy, save }: { completed: boolean; busy: boolean; save: (value: boolean) => Promise<boolean> }) {
  const [checked, setChecked] = useState(completed);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reconcile the optimistic checkbox with a refreshed stored value.
  useEffect(() => setChecked(completed), [completed]);
  return <label className={styles.check}><input type="checkbox" checked={checked} disabled={busy} onChange={async e => {
    const value = e.currentTarget.checked; setChecked(value);
    if (!await save(value)) setChecked(completed);
  }} />已完成</label>;
}
