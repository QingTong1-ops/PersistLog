"use client";
import Link from 'next/link';
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button, PageHeader } from '@/components/ui';
import { withPractice } from '@/lib/practice/service';
import { usePracticeResource } from '@/lib/practice/use-resource';
import type { HistoryFilter } from '@/lib/practice/types';
import { DemoNotice, ErrorNotice, PracticeBoundary, Stats, SubmissionHistory } from './common';
import styles from './practice.module.css';

export function PracticeView(props: { filter: HistoryFilter; page: number }) {
  return <PracticeBoundary><Overview {...props} /></PracticeBoundary>;
}
function Overview({ filter, page }: { filter: HistoryFilter; page: number }) {
  const router = useRouter();
  const load = useCallback((signal: AbortSignal) => withPractice(api => ({ overview: api.overview(filter, page), stats: api.statistics(30) }), signal), [filter, page]);
  const { data, error, loading, refresh } = usePracticeResource(load);
  const go = (status: string, target: number) => router.push('/practice?status=' + status + '&page=' + target);
  return <div className={'view ' + styles.page}>
    <PageHeader title="代码练习" description="提交代码、自测和说明，在独立评审页查看进度与反馈。" side={<Link className="btn btn--primary" href="/practice/new">提交代码</Link>} />
    <DemoNotice />
    {error && <ErrorNotice message={error} retry={refresh} />}
    {!data && loading && <section className={styles.card} aria-busy="true"><div className="skeleton skeleton--hero" /><p>正在读取提交记录…</p></section>}
    {data && <>
      <section className={styles.card + ' ' + styles.focus}><div><span className={styles.focusLabel}>下一项代码任务 · 示例</span><h2>{data.overview.currentTask.title}</h2><p className={styles.muted}>提交代码不自动完成今日任务；评审只提供静态反馈。</p><div className={styles.meta}><span>预计 {data.overview.currentTask.minutes} 分钟</span><span>中等难度</span><span>Python / Java</span><span>{data.overview.currentTask.source}</span></div></div><div className={styles.stack}><Link className="btn btn--primary" href="/practice/new?preset=lru">开始提交</Link><Link className="btn btn--secondary" href="/practice/04">查看示例评审</Link></div></section>
      <section className={styles.card} aria-label="近30天代码统计"><Stats data={data.stats} /></section>
      <div className={styles.split}>
        <section className={styles.card}><div className={styles.head}><div><h2>提交历史</h2><p>当前筛选共 {data.overview.total} 条记录</p></div><label className={styles.filter}>评审状态<select value={filter} onChange={e => go(e.target.value, 1)}><option value="all">全部状态</option><option value="pending">待评审 / 评审中</option><option value="succeeded">已评审</option><option value="insufficient">证据不足</option><option value="failed">评审失败</option></select></label></div>
          <SubmissionHistory items={data.overview.history} />
          {!data.overview.total && <div className={styles.empty}><h3>当前筛选没有记录</h3><p>切换状态查看其他提交，或开始新的练习。</p><Button onClick={() => go('all', 1)}>查看全部</Button></div>}
          <div className={styles.pagination}><Button size="sm" disabled={data.overview.page <= 1} onClick={() => go(filter, data.overview.page - 1)}>上一页</Button><span className={styles.muted}>第 {data.overview.page} / {Math.max(1, Math.ceil(data.overview.total / 5))} 页</span><Button size="sm" disabled={data.overview.page * 5 >= data.overview.total} onClick={() => go(filter, data.overview.page + 1)}>下一页</Button></div>
          <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>刷新状态</Button>
        </section>
        <aside className={styles.stack}><section className={styles.card}><h2>提交后不用等待</h2><ol><li>保留代码与自测快照。</li><li>可离开评审页，再回来查看。</li><li>按证据修改，再新建提交。</li></ol><p className={styles.muted}>不执行代码，不提供 AC 判定，不测运行时间或内存。</p></section>
          <section className={styles.card}><h2>待完成的改进</h2><ul className={styles.list}>{data.overview.improvements.map(({ item, submissionId, reviewId }) => <li className={styles.row} key={submissionId + item.id}><div><strong>{item.title}</strong><small>{item.verification}</small><Link href={'/practice/' + submissionId + '?review=' + reviewId}>查看改进说明 →</Link></div></li>)}</ul>{!data.overview.improvements.length && <p className={styles.empty}>暂无待完成改进。</p>}</section>
        </aside>
      </div>
    </>}
  </div>;
}
