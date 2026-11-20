"use client";
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui';
import { IS_MOCK } from '@/lib/config/data-source';
import { PRACTICE_LIVE_AVAILABLE } from '@/lib/practice/live';
import { withPractice } from '@/lib/practice/service';
import { usePracticeResource } from '@/lib/practice/use-resource';
import type { CodeStatistics } from '@/lib/practice/types';
import { ErrorNotice, Stats, SubmissionHistory } from '@/components/practice/common';
import styles from '@/components/practice/practice.module.css';

export function CodeDashboardSection() {
  if (!IS_MOCK && !PRACTICE_LIVE_AVAILABLE) return <section id="code-feedback" className={styles.card}><h2>代码反馈</h2><p className={styles.muted}>P2 代码统计接口尚未接入；不影响上方执行看板。</p><Link href="/practice">查看代码练习说明 →</Link></section>;
  return <MockCodeDashboard />;
}
function MockCodeDashboard() {
  const [days, setDays] = useState<7 | 30>(30);
  const load = useCallback((signal: AbortSignal) => withPractice(api => api.statistics(days), signal), [days]);
  const { data, loading, error, refresh } = usePracticeResource(load);
  return <section id="code-feedback" className={styles.page} aria-labelledby="code-feedback-title">
    <div className={styles.head}><div><h2 id="code-feedback-title">代码评分趋势</h2><p>Mock 演示 · 自测为用户声明，代码得分不代表能力准备度。</p></div><div className={styles.actions} role="group" aria-label="代码统计周期">{([7, 30] as const).map(n => <Button size="sm" key={n} aria-pressed={days === n} variant={days === n ? 'primary' : 'secondary'} onClick={() => setDays(n)}>近 {n} 天</Button>)}<Button size="sm" onClick={refresh} disabled={loading}>刷新代码统计</Button></div></div>
    {error && <ErrorNotice message={error} retry={refresh} />}
    {!data && loading && <div className={styles.card} aria-busy="true"><div className="skeleton skeleton--card" />正在读取代码统计…</div>}
    {data && <><section className={styles.card}><Stats data={data} /></section><section className={styles.card}><div className={styles.head}><h3>近 {data.days} 天 · 平均评审分与自测通过率</h3><span className={styles.muted}>实线：评分（分） · 虚线：自测（%）</span></div>
      {data.submissions ? <Trend data={data} /> : <div className={styles.empty}><h3>这个周期还没有提交</h3><Link className="btn btn--primary" href="/practice/new">提交代码</Link></div>}
      <p className={styles.muted}>没有有效评分/自测的日期保留空点，不补 0。仅统计每次提交的最新有效评审；按提交日期归集。</p>
      <details className={styles.process}><summary>查看图表数据与口径</summary><ul className={styles.list}>{data.points.map(p => <li className={styles.row} key={p.date}><span>{p.date}</span><span>评分 {p.average ?? '未评估'} · 自测 {p.selftest == null ? '未提供' : p.selftest + '%'} · {p.count} 次提交</span></li>)}</ul></details>
    </section><section className={styles.card}><div className={styles.head}><h3>最近提交</h3><Link href="/practice">全部提交 →</Link></div><SubmissionHistory items={data.recent} /></section></>}
  </section>;
}
function Trend({ data }: { data: CodeStatistics }) {
  const x = (i: number) => 40 + i * 680 / Math.max(1, data.points.length - 1);
  const y = (value: number) => 205 - value * 1.8;
  function path(key: 'average' | 'selftest') {
    let previous = false;
    return data.points.map((p, i) => { const v = p[key]; if (v == null) { previous = false; return ''; } const segment = (previous ? 'L' : 'M') + x(i) + ',' + y(v); previous = true; return segment; }).join(' ');
  }
  return <svg className={styles.chart} viewBox="0 0 760 245" role="img" aria-label={'近 ' + data.days + ' 天，' + data.submissions + ' 次提交，平均评审分 ' + (data.average ?? '未评估') + '；完整数据见下方列表'}>
    {[0, 25, 50, 75, 100].map(v => <g key={v}><line x1="40" x2="720" y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x="6" y={y(v) + 4}>{v}</text></g>)}
    <path className={styles.trendPrimary} d={path('average')} /><path className={styles.trendSecondary} d={path('selftest')} />
    {data.points.map((p, i) => <g key={p.date}>{p.average != null && <circle cx={x(i)} cy={y(p.average)} r="4" fill="var(--primary)"><title>{p.date} · 平均 {p.average} 分</title></circle>}{p.selftest != null && <circle cx={x(i)} cy={y(p.selftest)} r="3" fill="var(--teal)"><title>{p.date} · 自测 {p.selftest}%</title></circle>}{(i === 0 || i === data.points.length - 1 || i % (data.days === 30 ? 7 : 2) === 0) && <text x={x(i)} y="232" textAnchor={i === 0 ? 'start' : i === data.points.length - 1 ? 'end' : 'middle'}>{p.date.slice(5)}</text>}</g>)}
  </svg>;
}
