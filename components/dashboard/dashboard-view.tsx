"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Info,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { EmptyState, PageHeader, Segmented, Tag } from "@/components/ui";
import { DASHBOARD_DATA } from "@/lib/mock-data";
import { useAppStore } from "@/lib/store/app-store";
import { live } from "@/lib/api/live";
import { daysBetween, formatShortDate } from "@/lib/api/mappers";
import type { DashboardDataset } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPE_COLORS = ["var(--brand-600)", "var(--teal-600)", "var(--sky-600)", "#e8aa4d", "#9b8afb", "#c7ccda"];

const EMPTY_DASHBOARD: DashboardDataset = {
  planned: 0,
  completed: 0,
  carry: 0,
  active: 0,
  periodActive: 0,
  planMinutes: 0,
  actualMinutes: 0,
  status: { completed: 0, carry: 0, skipped: 0, blocked: 0 },
  types: [],
  days: [],
};

export function DashboardView({ demoState }: { demoState?: string }) {
  const [period, setPeriod] = useState<7 | 30>(7);
  const { live: isLive, profile, routes } = useAppStore();
  const [liveData, setLiveData] = useState<DashboardDataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [overview, trends, distribution, forecast] = await Promise.all([
          live.dashboard.overview(period),
          live.dashboard.trends(period),
          live.dashboard.distribution(period),
          live.dashboard.forecast(),
        ]);
        if (cancelled) return;

        const buckets = new Map(distribution.by_status.map((bucket) => [bucket.key, bucket.planned_tasks]));
        const activeDays = trends.points.filter((point) => point.completed_tasks > 0).length;
        const routeTitle = forecast.routes[0]?.title;
        const targetDate = profile.targetDate || forecast.routes[0]?.target_date || "";
        const lateDays =
          targetDate && forecast.forecast_end_date
            ? Math.max(0, daysBetween(targetDate, forecast.forecast_end_date) - 1)
            : 0;

        setLiveData({
          planned: overview.planned_tasks,
          completed: overview.completed_tasks,
          carry: overview.carry_over_count,
          active: activeDays,
          periodActive: activeDays,
          planMinutes: overview.planned_minutes,
          actualMinutes: overview.actual_minutes,
          status: {
            completed: buckets.get("completed") ?? 0,
            carry: (buckets.get("postponed") ?? 0) + (buckets.get("carry_over") ?? 0),
            skipped: buckets.get("skipped") ?? 0,
            blocked: buckets.get("blocked") ?? 0,
          },
          types: distribution.by_task_type.map((bucket) => ({
            label: bucket.label,
            count: bucket.planned_tasks,
          })),
          days: trends.points.map((point) => ({
            label: formatShortDate(point.date),
            plan: point.planned_tasks,
            done: point.completed_tasks,
            carry: point.carry_over_count,
          })),
          forecast: {
            endDate: forecast.forecast_end_date,
            targetDate,
            remainingMinutes: forecast.remaining_minutes,
            throughputMinutes: forecast.throughput_minutes,
            lateDays,
            routeTitle,
          },
        });
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "看板加载失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [isLive, period, profile.targetDate]);

  const data = isLive ? liveData ?? EMPTY_DASHBOARD : DASHBOARD_DATA[period];
  const rate = data.planned ? Math.round((data.completed / data.planned) * 100) : 0;
  const carryRate = data.planned ? Math.round((data.carry / data.planned) * 100) : 0;
  const deviation = data.planMinutes
    ? Math.round((data.actualMinutes / data.planMinutes) * 1000) / 10
    : 0;
  const empty = isLive ? !loading && data.planned === 0 : demoState === "empty";

  const donutStyle = useMemo(() => {
    const total =
      data.status.completed + data.status.carry + data.status.skipped + data.status.blocked || 1;
    const p1 = (data.status.completed / total) * 100;
    const p2 = p1 + (data.status.carry / total) * 100;
    const p3 = p2 + (data.status.skipped / total) * 100;
    return `conic-gradient(var(--teal-600) 0 ${p1}%, var(--amber-600) ${p1}% ${p2}%, #c7ccda ${p2}% ${p3}%, var(--coral-600) ${p3}% 100%)`;
  }, [data]);

  const maxPlan = Math.max(...data.days.map((day) => day.plan), 1);
  const dense = data.days.length > 10;
  const forecast = data.forecast ?? {
    endDate: "2026-11-12",
    targetDate: "2026-11-10",
    remainingMinutes: 1110,
    throughputMinutes: 96,
    lateDays: 2,
    routeTitle: "Java 后端实习准备",
  };

  return (
    <div className="view">
      <PageHeader
        eyebrow="执行记录"
        title="执行看板"
        description={loading ? "正在读取执行数据…" : "查看任务完成、时间安排和路线预测。"}
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

      {error ? (
        <div className="insight insight--warn" style={{ marginBottom: 16 }}>
          <TriangleAlert className="icon" aria-hidden="true" />
          <span>看板加载失败：{error}</span>
        </div>
      ) : null}

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
                <span className="delta delta--neutral">近 {period} 天</span>
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
                <span className="delta delta--neutral">实际占计划 {deviation}%</span>
                <span>
                  实际{data.actualMinutes <= data.planMinutes ? "少于" : "多于"}计划 {Math.abs(data.planMinutes - data.actualMinutes)} 分钟
                </span>
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
                <span className="delta delta--warn">顺延任务</span>
                <span>{data.carry} / {data.planned} 项</span>
              </div>
            </div>

            <div className="card metric-card">
              <div className="metric-card__top">
                <span className="metric-card__label">活跃天数</span>
                <span className="metric-card__icon">
                  <Calendar className="icon" aria-hidden="true" />
                </span>
              </div>
              <div className="metric-card__value">
                {data.active}
                <small>天</small>
              </div>
              <div className="metric-card__foot">
                <span className="delta delta--neutral">有完成记录的天数</span>
                <span>近 {period} 天</span>
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
            </section>

            <section className="card" aria-labelledby="dist-title">
              <div className="card__head">
                <div>
                  <h2 id="dist-title">任务分布</h2>
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
                </div>
                <Link className="card__link" href="/routes">
                  管理路线
                </Link>
              </div>
              <div className="route-mini-list">
                {routes.slice(0, 3).map((route) => (
                  <div className="route-mini" key={route.id}>
                    <div className="route-mini__top">
                      <b>{route.name}</b>
                      <span>
                        {route.progress}% · {route.doneCount}/{route.taskCount}
                      </span>
                    </div>
                    <div className="progress-track">
                      <span style={{ width: `${route.progress}%` }} />
                    </div>
                    <div className="route-mini__foot">
                      <span>预测 {formatShortDate(route.forecast)}</span>
                      <span>{route.status === "active" ? "执行中" : route.status === "paused" ? "已暂停" : "草稿"}</span>
                    </div>
                  </div>
                ))}
                {!routes.length ? (
                  <p className="muted" style={{ fontSize: 11 }}>
                    还没有路线。完成一次导入或创建路线后，这里会显示进度。
                  </p>
                ) : null}
              </div>
            </section>

            <section className="card" aria-labelledby="forecast-kpi-title">
              <div className="card__head">
                <div>
                  <h2 id="forecast-kpi-title">预测与风险</h2>
                  <p>根据剩余工作量和近期完成速度估算。</p>
                </div>
                <span className={cn("status", forecast.lateDays > 0 ? "status--risk" : "status--active")}>
                  {forecast.lateDays > 0 ? `晚 ${forecast.lateDays} 天` : "按目标"}
                </span>
              </div>
              <div className="forecast-panel">
                <div className="forecast-panel__date">
                  {formatShortDate(forecast.endDate)} <span>预计完成</span>
                </div>
                <div className="forecast-panel__rows">
                  <div className="forecast-panel__row">
                    <span>目标日期</span>
                    <b>{forecast.targetDate || "待设置"}</b>
                  </div>
                  <div className="forecast-panel__row">
                    <span>剩余分钟</span>
                    <b>{forecast.remainingMinutes} 分钟</b>
                  </div>
                  <div className="forecast-panel__row">
                    <span>近期日均完成</span>
                    <b>{forecast.throughputMinutes} 分钟/天</b>
                  </div>
                  <div className="forecast-panel__row">
                    <span>风险</span>
                    <b className={forecast.lateDays > 0 ? "text-risk" : "text-good"}>
                      {forecast.lateDays > 0 ? `预测晚于目标 ${forecast.lateDays} 天` : "当前按目标推进"}
                    </b>
                  </div>
                </div>
                <div className={cn("insight", forecast.lateDays > 0 ? "insight--warn" : "insight--good")} style={{ marginTop: 12 }}>
                  <TriangleAlert className="icon" aria-hidden="true" />
                  <span>
                    {forecast.lateDays > 0
                      ? `「${forecast.routeTitle ?? "当前路线"}」剩余 ${forecast.remainingMinutes} 分钟；建议优先处理顺延任务，或拆分耗时较长的任务。`
                      : "当前完成速度可以覆盖剩余工作量。"}
                  </span>
                </div>
                <div className="forecast-actions">
                  <Link className="btn btn--secondary btn--sm" href="/routes">管理路线</Link>
                  <Link className="btn btn--primary btn--sm" href="/today">查看今日任务</Link>
                </div>
              </div>
            </section>
          </div>

          <details className="metric-notes">
            <summary>
              <Info className="icon" aria-hidden="true" />
              指标口径
            </summary>
            <div className="metric-notes__body">
              <p><b>完成率</b>：已完成任务数占计划任务数的比例；跳过计入计划但不计完成，放弃不计入计划。</p>
              <p><b>顺延率</b>：从之前日期顺延的任务数占计划任务数的比例。</p>
              <p><b>路线进度</b>：已完成任务数占路线总任务数的比例，同一任务不重复计算。</p>
              <p><b>活跃天数</b>：所选周期内有完成记录的天数，不是连续打卡。</p>
              <p><b>预计完成日期</b>：根据剩余工作量和近 14 天完成速度，结合每日容量估算。</p>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
