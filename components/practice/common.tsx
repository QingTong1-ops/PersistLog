"use client";
import Link from 'next/link';
import { Button } from '@/components/ui';
import { IS_MOCK } from '@/lib/config/data-source';
import { STATUS_LABEL, type Submission, type ReviewStatus, type CodeStatistics } from '@/lib/practice/types';
import styles from './practice.module.css';

export function PracticeBoundary({ children }: { children: React.ReactNode }) {
  if (!IS_MOCK) return <section className={styles.card}><h2>代码练习接口待接入</h2><p className={styles.muted}>当前为 Live 模式，暂未启用提交、评审和评分查询。不会发送请求或显示演示结果。</p><Link href="/today">返回今日计划</Link></section>;
  return <>{children}</>;
}
export function DemoNotice() { return <p className={styles.notice}>演示数据 · 代码与草稿仅保存在本标签页，不上传、不执行代码，也不调用 AI。请勿填写敏感信息。</p>; }
export function Status({ value }: { value: ReviewStatus }) { return <span className={styles.badge} data-status={value}>{STATUS_LABEL[value]}</span>; }
export function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  return <div className={styles.error} role="alert">{message}{retry ? <div className={styles.actions}><Button size="sm" onClick={retry}>重新读取</Button></div> : null}</div>;
}
export function dateLabel(date: string) { return new Date(date).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }); }
export function SubmissionHistory({ items }: { items: Submission[] }) {
  return <ul className={styles.list}>{items.map(s => { const latest = s.attempts[s.attempts.length - 1]; return <li key={s.id}>
    <Link className={styles.row} href={'/practice/' + encodeURIComponent(s.id)}>
      <div><strong>{s.input.title}</strong><small>{dateLabel(s.createdAt)} · {s.input.language} · {s.input.source}</small><small>{s.input.testStatus === 'provided' ? '自报用例 ' + s.input.passed + '/' + s.input.total : '尚未自测'} · {s.attempts.length} 次评审</small></div>
      <div className={styles.side}><Status value={latest.status} /><small>{latest.status === 'succeeded' && latest.result?.score != null ? latest.result.score + ' / 100' : '暂无评分'} →</small></div>
    </Link></li>; })}</ul>;
}
export function Stats({ data }: { data: CodeStatistics }) {
  return <div className={styles.stats}>
    {[[`近 ${data.days} 天提交`, data.submissions + ' 次', '有效评分 ' + data.scored + ' 次'], ['平均评审得分', data.average ?? '未评估', '仅统计最新有效评分'], ['最高评审得分', data.highest ?? '未评估', '不是能力准备度'], ['改进项完成', data.improved + ' / ' + data.improvements, '用户主动标记']].map(([label, value, note]) => <div className={styles.stat} key={String(label)}><span className={styles.muted}>{label}</span><strong>{value}</strong><small>{note}</small></div>)}
  </div>;
}
export function MobileDirectory() {
  return <details className={styles.mobileDirectory}><summary>功能目录</summary><nav aria-label="窄屏功能入口"><Link href="/practice">代码练习</Link><Link href="/practice/new">提交代码</Link><Link href="/dashboard#code-feedback">代码评分趋势</Link><Link href="/import">导入计划</Link></nav></details>;
}
