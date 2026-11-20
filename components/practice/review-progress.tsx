"use client";
/* eslint-disable react-hooks/set-state-in-effect -- hydrate only the process-summary UI preference. */
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import type { ReviewDetail } from '@/lib/practice/types';
import { Status, dateLabel } from './common';
import styles from './practice.module.css';

export function ReviewProgress({ data, refresh, loading }: { data: ReviewDetail; refresh: () => void; loading: boolean }) {
  const { selected: attempt, submission } = data;
  const key = 'persistlog:mock:review-ui:' + submission.id + ':' + attempt.id;
  const [choice, setChoice] = useState<boolean | null>(null);
  useEffect(() => { try { const value = sessionStorage.getItem(key); setChoice(value === null ? null : value === 'open'); } catch { /* storage is optional for UI preference */ } }, [key]);
  const processing = ['pending', 'reviewing'].includes(attempt.status);
  const open = choice ?? processing;
  return <section className={styles.card} aria-labelledby="review-progress-title">
    <div className={styles.head}><div><h2 id="review-progress-title">第 {attempt.number} 次评审 · {processing ? '处理中' : '处理已结束'}</h2><p>{dateLabel(attempt.createdAt)} · Mock 模拟，不调用 AI</p></div><Status value={attempt.status} /></div>
    {processing && <p className={styles.notice} role="status">提交已保存，正在模拟异步评审。可以离开此页，稍后通过同一地址恢复查看。</p>}
    <div className={styles.head}><span>{data.stage}</span><span className={styles.muted}>{data.progress}%（模拟）</span></div>
    <div className={styles.track} role="progressbar" aria-label="模拟评审进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={data.progress}><span style={{ width: data.progress + '%' }} /></div>
    <details className={styles.process} open={open}><summary onClick={e => { e.preventDefault(); const next = !open; setChoice(next); try { sessionStorage.setItem(key, next ? 'open' : 'closed'); } catch { /* preference only */ } }}>评审过程摘要 · 读取范围与处理步骤</summary>
      <ol>{['接收题目、自测和复杂度说明', '读取 ' + submission.input.fileName + ' · ' + submission.input.code.split('\n').length + ' 行', '静态分析与自测对照', '整理评分、证据和改进方向'].map((text, i) => <li key={text} data-done={data.progress >= (i + 1) * 25}>{text} · {data.progress >= (i + 1) * 25 ? '模拟完成' : attempt.status === 'failed' ? '未完成' : '待处理'}</li>)}</ol>
      <p className={styles.muted}>只展示模拟读取范围和步骤，不展示或伪造模型内部思维链。</p>
    </details>
    <div className={styles.footer}><span className={styles.muted}>最后读取：{dateLabel(data.updatedAt)}</span><Button size="sm" onClick={refresh} disabled={loading}>刷新进度</Button></div>
  </section>;
}
