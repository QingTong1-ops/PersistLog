"use client";

/* eslint-disable react-hooks/set-state-in-effect -- route detail hydrates stages from the API. */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  Info,
  MoreHorizontal,
  Pause,
  Play,
  Route as RouteIcon,
} from "lucide-react";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Modal,
  Tag,
  useToast,
} from "@/components/ui";
import { INITIAL_ROUTES } from "@/lib/mock-data";
import { useAppStore } from "@/lib/store/app-store";
import { live, type RouteDetail } from "@/lib/api/live";
import { mapRouteStages, daysBetween, type StageView } from "@/lib/api/mappers";
import type { RouteStatus, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROUTE_STATUS: Record<RouteStatus, { label: string; className: string }> = {
  active: { label: "执行中", className: "status--active" },
  paused: { label: "已暂停", className: "status--paused" },
  draft: { label: "待确认", className: "status--draft" },
  archived: { label: "已归档", className: "status--neutral" },
};

const DOT_CLASS: Record<TaskStatus, string> = {
  completed: "status-dot--done",
  pending: "status-dot--pending",
  in_progress: "status-dot--pending",
  blocked: "status-dot--blocked",
  postponed: "status-dot--postponed",
  skipped: "status-dot--pending",
  abandoned: "status-dot--pending",
};

interface StageTask {
  id?: string;
  title: string;
  type: string;
  minutes: number;
  date: string;
  status: TaskStatus;
}

interface StageWeek {
  title: string;
  meta: string;
  tasks: StageTask[];
}

interface StageData {
  title: string;
  meta: string;
  progress: string;
  width: number;
  open: boolean;
  weeks: StageWeek[];
}

const STAGES: StageData[] = [
  {
    title: "阶段一 · 基础夯实",
    meta: "10/02 – 10/12 · 12 个任务",
    progress: "12 / 12 · 100%",
    width: 100,
    open: true,
    weeks: [
      {
        title: "第 1 周 · 网络基础",
        meta: "10/02 – 10/05 · 5 项",
        tasks: [
          { title: "TCP 三次握手与状态机", type: "八股", minutes: 45, date: "10/02", status: "completed" },
          { title: "HTTP 强缓存与协商缓存", type: "八股", minutes: 45, date: "10/03", status: "completed" },
          { title: "HTTPS 握手与证书链", type: "八股", minutes: 40, date: "10/04", status: "completed" },
        ],
      },
      {
        title: "第 2 周 · JVM 与集合",
        meta: "10/06 – 10/12 · 7 项",
        tasks: [
          { title: "JVM 内存区域", type: "八股", minutes: 50, date: "10/06", status: "completed" },
          { title: "GC 收集器对比", type: "八股", minutes: 45, date: "10/08", status: "completed" },
          { title: "HashMap 扩容与红黑树", type: "八股", minutes: 45, date: "10/10", status: "completed" },
        ],
      },
    ],
  },
  {
    title: "阶段二 · 算法与八股",
    meta: "10/13 – 10/26 · 14 个任务 · 当前阶段",
    progress: "9 / 14 · 64%",
    width: 64,
    open: true,
    weeks: [
      {
        title: "第 3 周 · 树与图",
        meta: "10/13 – 10/19 · 6 项",
        tasks: [
          { title: "二叉树遍历与复杂度", type: "算法", minutes: 60, date: "10/14", status: "completed" },
          { id: "t1", title: "完成 2 道二叉树中等题", type: "算法", minutes: 60, date: "10/19", status: "completed" },
          { id: "t4", title: "回答 3 道 JVM 高频问题", type: "八股", minutes: 35, date: "10/19", status: "pending" },
          { title: "图的最短路径 · Dijkstra", type: "算法", minutes: 60, date: "10/18", status: "blocked" },
        ],
      },
      {
        title: "第 4 周 · 动态规划",
        meta: "10/20 – 10/26 · 5 项",
        tasks: [
          { title: "区间 DP · 3 道中等题", type: "算法", minutes: 60, date: "10/20", status: "pending" },
          { title: "背包问题 · 状态转移", type: "算法", minutes: 60, date: "10/22", status: "pending" },
        ],
      },
    ],
  },
  {
    title: "阶段三 · 工程与项目",
    meta: "10/27 – 11/02 · 10 个任务",
    progress: "5 / 10 · 50%",
    width: 50,
    open: false,
    weeks: [
      {
        title: "第 5 周 · 缓存与订单",
        meta: "10/27 – 11/02 · 10 项",
        tasks: [
          { id: "t3", title: "完成订单系统缓存方案", type: "工程", minutes: 70, date: "10/18 → 10/19", status: "postponed" },
          { title: "缓存穿透 / 击穿 / 雪崩", type: "八股", minutes: 45, date: "10/18", status: "completed" },
          { title: "压测报告与容量结论", type: "工程", minutes: 60, date: "11/01", status: "pending" },
        ],
      },
    ],
  },
  {
    title: "阶段四 · 简历与冲刺",
    meta: "11/03 – 11/06 · 6 个任务",
    progress: "0 / 6 · 0%",
    width: 0,
    open: false,
    weeks: [
      {
        title: "第 6 周 · 简历与模拟面试",
        meta: "11/03 – 11/06 · 6 项",
        tasks: [
          { title: "简历项目重写 · 订单系统", type: "简历", minutes: 60, date: "11/03", status: "pending" },
          { title: "3 次模拟面试 · 项目追问", type: "面试", minutes: 90, date: "11/05", status: "pending" },
        ],
      },
    ],
  },
];

type DetailTab = "structure" | "versions" | "settings";

export function RouteDetailView({ routeId }: { routeId: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const {
    routes,
    routeStates,
    setRouteStatus,
    routeDone,
    routePercent,
    tasks,
    live: isLive,
    refreshLive,
  } = useAppStore();
  const route = routes.find((item) => String(item.id) === routeId) ?? routes[0] ?? INITIAL_ROUTES[0];
  const status = routeStates[route.id] ?? route.status;
  const statusMeta = ROUTE_STATUS[status] ?? ROUTE_STATUS.active;
  const isPrimary = isLive ? false : route.id === 1;
  const [detail, setDetail] = useState<RouteDetail | null>(null);
  const [stages, setStages] = useState<StageView[]>(STAGES);
  const [tab, setTab] = useState<DetailTab>("structure");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [startDate, setStartDate] = useState("2026-10-02");
  const [dailyMinutes, setDailyMinutes] = useState(300);
  const [factor, setFactor] = useState(80);
  const effective = Math.round((dailyMinutes * factor) / 100);
  const hasStructure = isLive ? Boolean(detail?.stages.length) : isPrimary;
  const progress = isLive ? route.progress : isPrimary ? routePercent : route.progress;
  const doneCount = isLive ? route.doneCount : isPrimary ? routeDone : route.doneCount;
  const lateDays =
    route.targetDate && route.forecast
      ? Math.max(0, daysBetween(route.targetDate, route.forecast) - 1)
      : 0;

  useEffect(() => {
    if (!isLive || !route.apiId) {
      setDetail(null);
      setStages(STAGES);
      return;
    }
    let cancelled = false;
    live.routes
      .get(route.apiId)
      .then((next) => {
        if (cancelled) return;
        setDetail(next);
        setStages(mapRouteStages(next, tasks));
      })
      .catch((cause) => {
        if (cancelled) return;
        showToast(
          `<strong>路线详情加载失败。</strong> ${cause instanceof Error ? cause.message : "后端请求失败"}`,
          "risk"
        );
      });
    return () => {
      cancelled = true;
    };
  }, [isLive, route.apiId, showToast, tasks]);

  async function togglePause() {
    const next: RouteStatus = status === "active" ? "paused" : "active";
    try {
      await setRouteStatus(route.id, next);
      showToast(
        next === "paused"
          ? "<strong>路线已暂停。</strong> 暂停期间不会生成新的今日任务，已有执行记录保留。"
          : "<strong>路线已恢复。</strong> 下一次生成今日计划时会重新纳入未完成任务。"
      );
    } catch (cause) {
      showToast(
        `<strong>路线状态没有保存。</strong> ${cause instanceof Error ? cause.message : "后端请求失败"}`,
        "risk"
      );
    }
  }

  function taskStatus(task: StageTask): TaskStatus {
    if (task.id) {
      const found = tasks.find((item) => item.taskId === task.id || item.id === task.id);
      if (found) return found.status;
    }
    return task.status;
  }

  return (
    <div className="view">
      <Link className="back-link" href="/routes">
        <ArrowLeft className="icon" aria-hidden="true" />
        返回路线列表
      </Link>

      <section className="route-hero">
        <div>
          <span className="eyebrow">Route · {route.days} 天</span>
          <h1>{route.name}</h1>
          <div className="route-hero__meta">
            <span>目标：{route.job} · {route.targetDate}</span>
            <span>路线周期：{route.startDate} → {route.endDate ?? "待排期"}</span>
            <span className={cn("status", statusMeta.className)}>{statusMeta.label}</span>
            <Tag variant="outline">版本 v{detail?.current_version ?? (isLive ? 1 : 3)}</Tag>
          </div>
        </div>
        <div className="route-hero__actions">
          <Button variant="secondary" size="sm" onClick={() => setAdjustOpen(true)}>
            <Calendar className="icon" aria-hidden="true" />
            调整日期 / 容量
          </Button>
          {status !== "archived" ? (
            <Button variant="secondary" size="sm" onClick={togglePause}>
              {status === "active" ? (
                <Pause className="icon" aria-hidden="true" />
              ) : (
                <Play className="icon" aria-hidden="true" />
              )}
              {status === "active" ? "暂停路线" : "恢复路线"}
            </Button>
          ) : (
            <Button variant="secondary" size="sm" disabled>
              已归档
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            aria-label="更多路线操作"
            onClick={() => showToast("<strong>更多操作：</strong> 归档路线、查看版本、导出路线。")}
          >
            <MoreHorizontal className="icon" aria-hidden="true" />
          </Button>
        </div>
      </section>

      <div className="summary-strip">
        <div className="summary-strip__item">
          <span>路线周期</span>
          <b>{route.days} <small>天</small></b>
        </div>
        <div className="summary-strip__item">
          <span>任务 / 已完成</span>
          <b>{route.taskCount} <small>/ {doneCount} 项</small></b>
        </div>
        <div className="summary-strip__item">
          <span>路线进度</span>
          <b>{progress} <small>%</small></b>
        </div>
        <div className="summary-strip__item">
          <span>预计完成</span>
          <b className={lateDays > 0 ? "text-risk" : undefined}>
            {route.forecast} <small>{lateDays > 0 ? `晚 ${lateDays} 天` : ""}</small>
          </b>
        </div>
      </div>

      <div className="detail-tabs" role="tablist" aria-label="路线详情">
        {[
          { value: "structure" as const, label: "阶段与任务" },
          { value: "versions" as const, label: "版本记录" },
          { value: "settings" as const, label: "路线设置" },
        ].map((item) => (
          <button
            key={item.value}
            className={cn("detail-tab", tab === item.value && "is-active")}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            onClick={() => setTab(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "structure" ? (
        <div className="detail-panel">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "2px 0 12px" }}>
            <p className="muted" style={{ fontSize: 10 }}>
              共 {route.taskCount} 项任务，按阶段 / 周折叠；任务状态与今日执行记录同步。
            </p>
            <div style={{ display: "flex", gap: 7 }}>
              <Button variant="secondary" size="xs" onClick={() => showToast("<strong>新增阶段：</strong> 填写名称、开始日期和目标。")}>
                + 阶段
              </Button>
              <Button variant="secondary" size="xs" onClick={() => showToast("<strong>新增周目标：</strong> 归属于当前阶段，可设置日期范围。")}>
                + 周
              </Button>
              <Button variant="primary" size="xs" onClick={() => showToast("<strong>新增任务：</strong> 标题、类型、时长、产出和验收标准为必填。")}>
                + 任务
              </Button>
            </div>
          </div>

          {hasStructure ? (
            stages.map((stage, stageIndex) => (
            <details className="stage" open={stage.open} key={stage.title}>
              <summary>
                <span className="stage__chevron">
                  <ChevronRight className="icon" aria-hidden="true" />
                </span>
                <span className="stage__title">
                  <strong>{stage.title}</strong>
                  <span>{stage.meta}</span>
                </span>
                <span className="stage__progress">
                  <span className="progress-track">
                    <span style={{ width: `${stage.width}%` }} />
                  </span>
                  <span>{stage.progress}</span>
                </span>
              </summary>
              <div className="stage__body">
                {stage.weeks.map((week, weekIndex) => (
                  <details className="week" open={stageIndex === 0 || weekIndex === 0} key={week.title}>
                    <summary>
                      <span className="week__title">{week.title}</span>
                      <span className="week__meta">{week.meta}</span>
                    </summary>
                    <div className="task-table">
                      <div className="task-table__row task-table__row--head">
                        <span>任务</span>
                        <span>类型</span>
                        <span>时长</span>
                        <span>计划日</span>
                        <span />
                      </div>
                      {week.tasks.map((task) => {
                        const currentStatus = taskStatus(task);
                        return (
                          <div className="task-table__row" key={`${week.title}-${task.title}`}>
                            <span className="task-table__title">
                              <i className={cn("status-dot", DOT_CLASS[currentStatus])} />
                              <span>{task.title}</span>
                            </span>
                            <span className="task-table__meta">{task.type}</span>
                            <span className="task-table__meta">{task.minutes} 分钟</span>
                            <span className="task-table__meta">{task.date}</span>
                            <Button
                              variant="ghost"
                              size="xs"
                              aria-label="任务操作"
                              onClick={() => showToast("<strong>任务操作：</strong> 编辑、归档或重新排期。")}
                            >
                              <MoreHorizontal className="icon" aria-hidden="true" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                ))}
              </div>
            </details>
          ))
          ) : (
            <section className="card">
              <EmptyState
                icon={<RouteIcon className="icon" aria-hidden="true" />}
                title="这条路线还没有阶段结构"
                description="草稿路线需要先导入计划或手动添加阶段，确认后才会生成每日任务。"
                actions={
                  <>
                    <Link className="btn btn--primary btn--sm" href="/import">
                      导入 Markdown
                    </Link>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => showToast("<strong>新增阶段：</strong> 填写名称、开始日期和目标。")}
                    >
                      添加阶段
                    </Button>
                  </>
                }
              />
            </section>
          )}
        </div>
      ) : null}

      {tab === "versions" ? (
        <div className="detail-panel">
          <section className="card">
            <div className="card__head">
              <div>
                <h2>版本记录</h2>
                <p>每次确认导入、调整日期或容量都会生成快照；历史执行记录不随版本回滚。</p>
              </div>
              <Tag variant="brand">当前 v3</Tag>
            </div>
            <div className="version-list">
              {[
                { time: "2026-10-19 08:02", title: "v3 · 调整每日容量", body: "每日可用 300 分钟，容量系数 80%，有效容量 240 分钟；阶段日期不变。" },
                { time: "2026-10-12 21:10", title: "v2 · 顺延后重排", body: "3 项未完成任务进入下一日；路线预计完成日期由 11/06 调整为 11/08。" },
                { time: "2026-10-02 09:31", title: "v1 · 导入确认", body: "从「后端冲刺计划.md」创建 4 个阶段、6 个周目标、42 个任务。" },
              ].map((version) => (
                <div className="version-item" key={version.title}>
                  <time>{version.time}</time>
                  <div>
                    <strong>{version.title}</strong>
                    <p>{version.body}</p>
                  </div>
                  <Button variant="secondary" size="xs" onClick={() => showToast(`<strong>正在查看 ${version.title} 快照。</strong>`)}>
                    查看
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {tab === "settings" ? (
        <div className="detail-panel">
          <section className="card settings-panel">
            <div className="settings-panel__head">
              <div>
                <h2>路线设置</h2>
                <p>调整开始日期或每日容量，会平移未完成阶段和任务的日期，并生成新版本。</p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => showToast("<strong>路线设置已保存。</strong> 未完成阶段日期已按新容量重排。")}
              >
                保存并重排
              </Button>
            </div>
            <div className="settings-section">
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="route-start">开始日期</label>
                  <input id="route-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="route-capacity">每日可用分钟</label>
                  <input id="route-capacity" type="number" value={dailyMinutes} onChange={(event) => setDailyMinutes(Number(event.target.value))} />
                </div>
                <div className="field">
                  <label htmlFor="route-factor">容量系数</label>
                  <select id="route-factor" value={factor} onChange={(event) => setFactor(Number(event.target.value))}>
                    <option value={80}>80% · 推荐</option>
                    <option value={90}>90%</option>
                    <option value={60}>60%</option>
                    <option value={100}>100%</option>
                  </select>
                </div>
                <div className="field">
                  <label>有效日容量</label>
                  <input value={`${effective} 分钟`} disabled />
                </div>
              </div>
              <div className="impact-box" style={{ marginTop: 14 }}>
                <Info className="icon" aria-hidden="true" />
                <span>
                  预览：未完成的 3 个阶段整体后移 <b>2 天</b>，预计完成日期由 11/08 变为 <b>11/10</b>；已完成任务的日期不变。
                </span>
              </div>
            </div>
            <div className="settings-section">
              <div className="settings-section__title">
                <h3>路线状态</h3>
              </div>
              <div className="danger-zone">
                <div className="danger-row">
                  <div>
                    <strong>归档路线</strong>
                    <p>归档后不再生成每日任务，历史记录与看板数据保留。</p>
                  </div>
                  <Button variant="danger" size="xs" onClick={() => setArchiveOpen(true)}>
                    归档
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <AdjustRouteModal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        defaultStart={route.startDate}
        defaultMinutes={route.dailyCapacity ?? 144}
        onSave={async (start, minutes) => {
          if (isLive && route.apiId) {
            try {
              await live.routes.adjust(route.apiId, {
                start_date: start,
                daily_capacity_minutes: minutes,
              });
              await refreshLive();
              setAdjustOpen(false);
              showToast("<strong>路线已重排。</strong> 后端已生成新的路线版本，未完成任务的日期已平移。");
            } catch (cause) {
              showToast(
                `<strong>路线没有重排。</strong> ${cause instanceof Error ? cause.message : "后端请求失败"}`,
                "risk"
              );
            }
            return;
          }
          setAdjustOpen(false);
          showToast("<strong>路线已重排。</strong> 未完成阶段整体后移 2 天，并生成版本 v4。");
        }}
      />

      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="归档路线"
        subtitle="Java 后端实习准备 · 36 天"
        body={<p>归档后不再生成每日任务，历史记录与看板数据保留。正式版应支持从归档恢复。</p>}
        confirmText="确认归档"
        onConfirm={async () => {
          setArchiveOpen(false);
          try {
            await setRouteStatus(route.id, "archived");
            showToast("<strong>路线已归档。</strong> 不再生成每日任务，历史记录和看板数据保留。", "risk");
            router.push("/routes");
          } catch (cause) {
            showToast(
              `<strong>路线没有归档。</strong> ${cause instanceof Error ? cause.message : "后端请求失败"}`,
              "risk"
            );
          }
        }}
      />
    </div>
  );
}

function AdjustRouteModal({
  open,
  onClose,
  onSave,
  defaultStart,
  defaultMinutes,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (start: string, minutes: number) => void;
  defaultStart: string;
  defaultMinutes: number;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="调整日期与容量"
      subtitle="调整会平移未完成阶段和任务，并生成新的路线版本"
    >
      <form
        className="modal__form"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          onSave(
            String(data.get("start") ?? defaultStart),
            Number(data.get("minutes") ?? defaultMinutes)
          );
        }}
      >
        <div className="form-grid">
          <div className="field">
            <label htmlFor="adjust-start">开始日期</label>
            <input id="adjust-start" name="start" type="date" defaultValue={defaultStart} />
          </div>
          <div className="field">
            <label htmlFor="adjust-minutes">每日容量分钟</label>
            <input
              id="adjust-minutes"
              name="minutes"
              type="number"
              defaultValue={defaultMinutes}
            />
          </div>
          <div className="field">
            <label htmlFor="adjust-factor">容量系数</label>
            <select id="adjust-factor" defaultValue={80}>
              <option value={80}>80% · 推荐</option>
              <option value={90}>90%</option>
              <option value={100}>100%</option>
              <option value={60}>60%</option>
            </select>
          </div>
          <div className="field">
            <label>有效日容量</label>
            <input value={`${defaultMinutes} 分钟`} disabled />
          </div>
        </div>
        <div className="impact-box">
          <Info className="icon" aria-hidden="true" />
          <span>
            预览：未完成阶段整体后移 <b>2 天</b>，预计完成日期从 11/08 变为 <b>11/10</b>。已完成任务的日期不变。
          </span>
        </div>
        <div className="modal__foot">
          <Button variant="secondary" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" size="sm" type="submit">
            保存并重排
          </Button>
        </div>
      </form>
    </Modal>
  );
}
