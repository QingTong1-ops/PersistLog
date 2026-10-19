"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Info,
  Lock,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { EmptyState, PageHeader, Segmented, Tag } from "@/components/ui";
import { DASHBOARD_DATA } from "@/lib/mock-data";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

const TYPE_COLORS = ["var(--brand-600)", "var(--teal-600)", "var(--sky-600)", "#e8aa4d", "#9b8afb", "#c7ccda"];

export function DashboardView({ demoState }: { demoState?: string }) {
  const [period, setPeriod] = useState<7 | 30>(7);
  const { routeDone, routePercent } = useAppStore();
  const data = DASHBOARD_DATA[period];
  const rate = Math.round((data.completed / data.planned) * 100);
  const carryRate = Math.round((data.carry / data.planned) * 100);
  const deviation = Math.round((data.actualMinutes / data.planMinutes) * 1000) / 10;
  const empty = demoState === "empty";

  const donutStyle = useMemo(() => {
    const total = data.status.completed + data.status.carry + data.status.skipped + data.status.blocked;
    const p1 = (data.status.completed / total) * 100;
    const p2 = p1 + (data.status.carry / total) * 100;
    const p3 = p2 + (data.status.skipped / total) * 100;
    return `conic-gradient(var(--teal-600) 0 ${p1}%, var(--amber-600) ${p1}% ${p2}%, #c7ccda ${p2}% ${p3}%, var(--coral-600) ${p3}% 100%)`;
  }, [data]);

  const maxPlan = Math.max(...data.days.map((day) => day.plan), 1);
  const dense = data.days.length > 10;

  return (
    <div className="view">
      <PageHeader
        eyebrow="Execution dashboard · Phase 1"
        title="执行看板"
        description="看计划有没有落地、时间花在哪里，以及路线什么时候完成。Phase 1 只看执行，不显示能力评分。"
        side={
          <Segmented
            options={[
              { value: 7, label: "近 7 天" },
              { value: 30, label: "近 30 天" },
            ]}
            value={period}
            onChange={(value) => setPeriod(value as 7 | 30)}
            ariaLabel="统计区间"
          />
        }
      />

      {empty ? (
        <section className="card">
          <EmptyState
            icon={<BarChart3 className="icon" aria-hidden="true" />}
            title="还没有可统计的执行记录"
            description="导入路线并生成第一份今日计划后，这里会展示完成率、趋势、分布和预测。"
            actions={
              <>
                <Link className="btn btn--primary btn--sm" href="/import">
                  导入计划
                </Link>
                <Link className="btn btn--secondary btn--sm" href="/today">
                  去今日页
                </Link>
              </>
            }
          />
        </section>
      ) : (
        <>
          <div className="metric-grid">
            <div className="card metric-card">
              <div className="metric-card__top">
                <span className="metric-card__label">计划完成率</span>
                <span className="metric-card__icon">
                  <CheckCircle2 className="icon" aria-hidden="true" />
                </span>
              </div>
              <div className="metric-card__value">{rate}%</div>
              <div className="metric-card__foot">
                <span className="delta">{period === 7 ? "+6pt 较前 7 天" : "+3pt 较前 30 天"}</span>
                <span>
                  {data.completed} / {data.planned} 项
                </span>
              </div>
            </div>

            <div className="card metric-card">
              <div className="metric-card__top">
                <span className="metric-card__label">计划 / 实际分钟</span>
                <span className="metric-card__icon">
                  <Clock className="icon" aria-hidden="true" />
                </span>
              </div>
              <div className="metric-card__value">
                {data.planMinutes}
                <small>/ {data.actualMinutes} 分钟</small>
              </div>
              <div className="metric-card__foot">
                <span className="delta delta--neutral">时间偏差 {deviation}%</span>
                <span>实际少于计划 {data.planMinutes - data.actualMinutes} 分钟</span>
              </div>
            </div>

            <div className="card metric-card">
              <div className="metric-card__top">
                <span className="metric-card__label">顺延率</span>
                <span className="metric-card__icon">
                  <RefreshCw className="icon" aria-hidden="true" />
                </span>
              </div>
              <div className="metric-card__value">{carryRate}%</div>
              <div className="metric-card__foot">
                <span className="delta delta--warn">
                  {data.carry} / {data.planned} 项
                </span>
                <span>目标 ≤ 20%</span>
              </div>
            </div>

            <div className="card metric-card">
              <div className="metric-card__top">
                <span className="metric-card__label">累计活跃天数</span>
                <span className="metric-card__icon">
                  <Calendar className="icon" aria-hidden="true" />
                </span>
              </div>
              <div className="metric-card__value">
                {data.active}
                <small>天</small>
              </div>
              <div className="metric-card__foot">
                <span className="delta">近 {period} 天活跃 {data.periodActive} 天</span>
                <span>中断不清零</span>
              </div>
            </div>
          </div>

          <div className="dashboard-grid">
            <section className="card" aria-labelledby="trend-title">
              <div className="card__head">
                <div>
                  <h2 id="trend-title">执行趋势</h2>
                  <p>近 {period} 天：计划任务数 / 完成任务数 / 顺延数</p>
                </div>
                <Tag variant="neutral">{period === 7 ? "按天" : "30 天"}</Tag>
              </div>
              <div className="chart-wrap">
                <div
                  className={cn("trend-chart", dense && "is-dense")}
                  role="img"
                  aria-label={`近 ${period} 天执行趋势：计划 ${data.planned} 项，完成 ${data.completed} 项，顺延 ${data.carry} 项`}
                >
                  {data.days.map((day, index) => {
                    const showLabel = !dense || index % 5 === 0 || index === data.days.length - 1;
                    const planHeight = day.plan ? Math.max(5, (day.plan / maxPlan) * 100) : 2;
                    const doneHeight = day.done ? Math.max(4, (day.done / maxPlan) * 100) : 0;
                    const carryHeight = day.carry ? Math.max(4, (day.carry / maxPlan) * 100) : 0;
                    return (
                      <div
                        className={cn("trend-day", index === data.days.length - 1 && "is-today")}
                        key={`${day.label}-${index}`}
                      >
                        <div className="trend-bars">
                          <span
                            className="trend-bar"
                            style={{ height: `${planHeight}%` }}
                            title={`${day.label} · 计划 ${day.plan} 项`}
                          />
                          <span
                            className="trend-bar trend-bar--done"
                            style={{ height: `${doneHeight}%` }}
                            title={`${day.label} · 完成 ${day.done} 项`}
                          />
                          {day.carry ? (
                            <span
                              className="trend-bar trend-bar--carry"
                              style={{ height: `${carryHeight}%` }}
                              title={`${day.label} · 顺延 ${day.carry} 项`}
                            />
                          ) : null}
                        </div>
                        <span className="trend-day__label">{showLabel ? day.label : ""}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="chart-legend">
                <span>
                  <i style={{ background: "#dcdef5" }} />
                  计划任务
                </span>
                <span>
                  <i style={{ background: "var(--brand-600)" }} />
                  完成任务
                </span>
                <span>
                  <i style={{ background: "var(--amber-600)" }} />
                  顺延
                </span>
                <span style={{ marginLeft: "auto" }}>
                  计划 {data.planned} · 完成 {data.completed} · 顺延 {data.carry}
                </span>
              </div>
              <div className="chart-note">
                <Info className="icon" aria-hidden="true" />
                <span>完成率按 occurrence 统计；skip 进入分母但不计完成，abandoned 不计入分母。</span>
              </div>
            </section>

            <section className="card" aria-labelledby="dist-title">
              <div className="card__head">
                <div>
                  <h2 id="dist-title">任务分布</h2>
                  <p>按类型与状态拆解，和今日页数据对账。</p>
                </div>
              </div>
              <div className="dist-body">
                {data.types.map((item, index) => (
                  <div className="dist-row" key={item.label}>
                    <span>{item.label}</span>
                    <div className="dist-track">
                      <span
                        style={{
                          width: `${Math.round((item.count / Math.max(...data.types.map((type) => type.count))) * 100)}%`,
                          background: TYPE_COLORS[index],
                        }}
                      />
                    </div>
                    <b>{item.count} 项</b>
                  </div>
                ))}
              </div>
              <div className="donut-wrap">
                <div className="donut" style={{ background: donutStyle }} role="img" aria-label={`完成 ${data.status.completed} 项、顺延 ${data.status.carry} 项、跳过 ${data.status.skipped} 项、阻塞 ${data.status.blocked} 项`}>
                  <div className="donut__center">
                    <b>
                      {Math.round((data.status.completed / (data.status.completed + data.status.carry + data.status.skipped + data.status.blocked)) * 100)}%
                    </b>
                    <span>完成率</span>
                  </div>
                </div>
                <div className="legend-list">
                  <div className="legend-item">
                    <i style={{ background: "var(--teal-600)" }} />
                    完成 <b>{data.status.completed}</b>
                  </div>
                  <div className="legend-item">
                    <i style={{ background: "var(--amber-600)" }} />
                    顺延 <b>{data.status.carry}</b>
                  </div>
                  <div className="legend-item">
                    <i style={{ background: "#c7ccda" }} />
                    跳过 <b>{data.status.skipped}</b>
                  </div>
                  <div className="legend-item">
                    <i style={{ background: "var(--coral-600)" }} />
                    阻塞 <b>{data.status.blocked}</b>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="dashboard-grid dashboard-grid--bottom">
            <section className="card" aria-labelledby="route-progress-title">
              <div className="card__head">
                <div>
                  <h2 id="route-progress-title">路线进度</h2>
                  <p>按任务去重：一个任务有任一 completed 即算完成。</p>
                </div>
                <Link className="card__link" href="/routes">
                  管理路线
                </Link>
              </div>
              <div className="route-mini-list">
                <div className="route-mini">
                  <div className="route-mini__top">
                    <b>Java 后端实习准备</b>
                    <span>
                      {routePercent}% · {routeDone}/42
                    </span>
                  </div>
                  <div className="progress-track">
                    <span style={{ width: `${routePercent}%` }} />
                  </div>
                  <div className="route-mini__foot">
                    <span>预测 11/12 · 晚于目标 2 天</span>
                    <span>执行中</span>
                  </div>
                </div>
                <div className="route-mini">
                  <div className="route-mini__top">
                    <b>秋招算法基础补齐</b>
                    <span>18% · 3/18</span>
                  </div>
                  <div className="progress-track">
                    <span style={{ width: "18%", background: "#aaaaf0" }} />
                  </div>
                  <div className="route-mini__foot">
                    <span>待确认计划日期</span>
                    <span>草稿</span>
                  </div>
                </div>
                <div className="route-mini">
                  <div className="route-mini__top">
                    <b>Redis 与 MySQL 专项</b>
                    <span>42% · 5/12</span>
                  </div>
                  <div className="progress-track">
                    <span style={{ width: "42%", background: "#d9a24a" }} />
                  </div>
                  <div className="route-mini__foot">
                    <span>暂停于 10/11</span>
                    <span>已暂停</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="card" aria-labelledby="forecast-kpi-title">
              <div className="card__head">
                <div>
                  <h2 id="forecast-kpi-title">预测与风险</h2>
                  <p>预测只基于剩余工作量和吞吐，不冒充能力评估。</p>
                </div>
                <span className="status status--risk">晚 2 天</span>
              </div>
              <div className="forecast-panel">
                <div className="forecast-panel__date">
                  11 月 12 日 <span>预计完成</span>
                </div>
                <div className="forecast-panel__rows">
                  <div className="forecast-panel__row">
                    <span>目标日期</span>
                    <b>2026-11-10</b>
                  </div>
                  <div className="forecast-panel__row">
                    <span>剩余任务 / 预计分钟</span>
                    <b>16 项 / 1,110 分钟</b>
                  </div>
                  <div className="forecast-panel__row">
                    <span>近 14 天吞吐</span>
                    <b>3.1 项/天</b>
                  </div>
                  <div className="forecast-panel__row">
                    <span>风险</span>
                    <b className="text-risk">预测晚于目标 2 天</b>
                  </div>
                </div>
                <div className="insight insight--warn" style={{ marginTop: 12 }}>
                  <TriangleAlert className="icon" aria-hidden="true" />
                  <span>未来 3 天优先顺延任务；若仍无改善，建议拆分 1 项工程任务或把目标日期外移。</span>
                </div>
              </div>
            </section>
          </div>

          <section className="card lock-card" style={{ marginTop: 18 }}>
            <div className="card__head">
              <div>
                <h2>后续能力</h2>
                <p>没有证据的能力一律显示未评估，不编造分数。</p>
              </div>
              <Tag variant="neutral">Phase 2 / 3</Tag>
            </div>
            <div className="lock-card__body">
              <div className="lock-item">
                <span className="lock-icon">
                  <Lock className="icon" aria-hidden="true" />
                </span>
                <div>
                  <strong>
                    代码评分趋势 <Tag variant="brand">Phase 2</Tag>
                  </strong>
                  <p>提交代码后的静态评审总分、维度趋势和改进项完成率。不执行代码、不做沙箱。</p>
                </div>
              </div>
              <div className="lock-item">
                <span className="lock-icon">
                  <Lock className="icon" aria-hidden="true" />
                </span>
                <div>
                  <strong>
                    完整能力与准备度 <Tag variant="neutral">Phase 3</Tag>
                  </strong>
                  <p>按证据计算掌握度、目标达成度与准备度；证据不足时显示未评估，覆盖率单独展示。</p>
                </div>
              </div>
            </div>
          </section>

          <details className="metric-notes">
            <summary>
              <Info className="icon" aria-hidden="true" />
              指标口径与数据来源
            </summary>
            <div className="metric-notes__body">
              <p>
                <b>完成率</b> = 完成 occurrence / 计划 occurrence；abandoned 不进分母，skipped 进分母但不计完成。
              </p>
              <p>
                <b>顺延率</b> = carry_over_from_id 非空的 occurrence / 计划 occurrence。
              </p>
              <p>
                <b>路线进度</b> = 已完成任务数 / 路线总任务数（按 task 去重）。
              </p>
              <p>
                <b>累计活跃天数</b> = 历史有完成记录的天数，不清零，不是连续打卡。
              </p>
              <p>
                <b>预测完成日期</b> = 剩余分钟 / 近 14 天吞吐，按用户容量和日界线换算。
              </p>
              <p>
                <b>数据来源</b> = 今日页、路线详情和数据库同一口径；看板数字必须能对账。
              </p>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
