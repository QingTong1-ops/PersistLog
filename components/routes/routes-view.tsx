"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import {
  Calendar,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Route as RouteIcon,
  Upload,
} from "lucide-react";
import { Button, EmptyState, Modal, PageHeader, Tag, useToast } from "@/components/ui";
import { INITIAL_ROUTES } from "@/lib/mock-data";
import { useAppStore } from "@/lib/store/app-store";
import type { RouteRecord, RouteStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROUTE_STATUS: Record<RouteStatus, { label: string; className: string }> = {
  active: { label: "执行中", className: "status--active" },
  paused: { label: "已暂停", className: "status--paused" },
  draft: { label: "待确认", className: "status--draft" },
  archived: { label: "已归档", className: "status--neutral" },
};

export function RoutesView({ demoState }: { demoState?: string }) {
  const { routeStates, setRouteStatus, routeDone, routePercent } = useAppStore();
  const { showToast } = useToast();
  const [extraRoutes, setExtraRoutes] = useState<RouteRecord[]>([]);
  const [newRouteOpen, setNewRouteOpen] = useState(false);

  const routes = useMemo(() => [...INITIAL_ROUTES, ...extraRoutes], [extraRoutes]);
  const empty = demoState === "empty" && routes.length === INITIAL_ROUTES.length;
  const activeCount = routes.filter((route) => (routeStates[route.id] ?? route.status) === "active").length;

  function statusOf(route: RouteRecord) {
    return routeStates[route.id] ?? route.status;
  }

  function handleAction(route: RouteRecord, action: "pause" | "resume") {
    const next: RouteStatus = action === "pause" ? "paused" : "active";
    setRouteStatus(route.id, next);
    showToast(
      next === "paused"
        ? "<strong>路线已暂停。</strong> 暂停期间不会生成新的今日任务，已有执行记录保留。"
        : "<strong>路线已恢复。</strong> 下一次生成今日计划时会重新纳入未完成任务。"
    );
  }

  return (
    <div className="view">
      <PageHeader
        eyebrow="Plans · Phase 1"
        title="学习路线"
        description="路线、阶段、周目标和任务保持清晰的层级关系。删除是归档，历史执行记录不会被物理删除。"
        side={
          <>
            <Button variant="secondary" size="sm" onClick={() => setNewRouteOpen(true)}>
              <Plus className="icon" aria-hidden="true" />
              新建路线
            </Button>
            <Link className="btn btn--primary btn--sm" href="/import">
              <Upload className="icon" aria-hidden="true" />
              导入 Markdown
            </Link>
          </>
        }
      />

      {!empty ? (
        <div className="metric-grid metric-grid--3">
          <div className="card metric-card">
            <div className="metric-card__top">
              <span className="metric-card__label">当前执行路线</span>
              <span className="metric-card__icon">
                <RouteIcon className="icon" aria-hidden="true" />
              </span>
            </div>
            <div className="metric-card__value">{activeCount}</div>
            <div className="metric-card__foot">
              <span className="delta">正在执行</span>
              <span>另有 1 条草稿、1 条暂停</span>
            </div>
          </div>
          <div className="card metric-card">
            <div className="metric-card__top">
              <span className="metric-card__label">路线任务</span>
              <span className="metric-card__icon">
                <Calendar className="icon" aria-hidden="true" />
              </span>
            </div>
            <div className="metric-card__value">
              42 <small>项</small>
            </div>
            <div className="metric-card__foot">
              <span className="delta">已完成 {routeDone} 项</span>
              <span>按任务去重</span>
            </div>
          </div>
          <div className="card metric-card">
            <div className="metric-card__top">
              <span className="metric-card__label">预计完成</span>
              <span className="metric-card__icon">
                <Calendar className="icon" aria-hidden="true" />
              </span>
            </div>
            <div className="metric-card__value">11.12</div>
            <div className="metric-card__foot">
              <span className="delta delta--risk">晚于目标 2 天</span>
              <span>目标 11.10</span>
            </div>
          </div>
        </div>
      ) : null}

      {routes.length && !empty ? (
        <section className="route-list" aria-label="路线列表">
          {routes.map((route) => {
            const status = statusOf(route);
            const meta = ROUTE_STATUS[status] ?? ROUTE_STATUS.draft;
            const isPrimaryRoute = route.id === 1;
            const progress = isPrimaryRoute ? routePercent : route.progress;
            const doneCount = isPrimaryRoute ? routeDone : route.doneCount;
            return (
              <article
                className={cn("route-item", status === "active" && "route-item--active")}
                data-route-id={route.id}
                key={route.id}
              >
                <div className="route-item__copy">
                  <div className="route-title-row">
                    <h3>{route.name}</h3>
                    <span className={cn("status", meta.className)}>{meta.label}</span>
                    {status === "active" ? <Tag variant="brand">当前主目标</Tag> : null}
                  </div>
                  <p>
                    目标：{route.job} · {route.targetDate} · {route.currentStage} · 第 {route.day} 天
                  </p>
                  <div className="route-progress">
                    <div className="progress-track">
                      <span
                        style={{
                          width: `${progress}%`,
                          background: status === "draft" ? "#aaaaf0" : status === "paused" ? "#d9a24a" : undefined,
                        }}
                      />
                    </div>
                    <b>{progress}%</b>
                  </div>
                  <div className="route-meta">
                    <span>
                      <b>{route.taskCount}</b> 个任务
                    </span>
                    <span>
                      已完成 <b>{doneCount}</b>
                    </span>
                    <span>
                      计划 <b>{route.plannedMinutes.toLocaleString()}</b> 分钟
                    </span>
                    <span className={route.id === 1 ? "text-risk" : undefined}>
                      {route.id === 1 ? `预测 ${route.forecast} · 晚 2 天` : route.forecast}
                    </span>
                  </div>
                </div>
                <div className="route-actions">
                  <Link className="btn btn--secondary btn--sm" href={`/routes/${route.id}`}>
                    查看详情
                  </Link>
                  {status === "active" ? (
                    <Button variant="ghost" size="sm" onClick={() => handleAction(route, "pause")}>
                      <Pause className="icon" aria-hidden="true" />
                      暂停
                    </Button>
                  ) : status === "paused" ? (
                    <Button variant="ghost" size="sm" onClick={() => handleAction(route, "resume")}>
                      <Play className="icon" aria-hidden="true" />
                      恢复
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => showToast("<strong>草稿路线不会进入今日计划。</strong> 确认后才会激活。")}
                    >
                      说明
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="更多路线操作"
                    onClick={() =>
                      showToast("<strong>更多操作：</strong> 调整开始日期、查看版本、归档路线。")
                    }
                  >
                    <MoreHorizontal className="icon" aria-hidden="true" />
                  </Button>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      {empty ? (
        <section className="card">
          <EmptyState
            icon={<RouteIcon className="icon" aria-hidden="true" />}
            title="还没有学习路线"
            description="导入一份 Markdown 计划，或者新建空路线手动添加阶段与任务。导入失败不会影响已有路线。"
            actions={
              <>
                <Link className="btn btn--primary btn--sm" href="/import">
                  导入 Markdown
                </Link>
                <Button variant="secondary" size="sm" onClick={() => setNewRouteOpen(true)}>
                  新建空路线
                </Button>
              </>
            }
          />
        </section>
      ) : null}

      <NewRouteModal
        open={newRouteOpen}
        onClose={() => setNewRouteOpen(false)}
        onCreate={(route) => {
          setExtraRoutes((current) => [...current, route]);
          setRouteStatus(route.id, "draft");
          setNewRouteOpen(false);
          showToast(`<strong>草稿路线「${route.name}」已创建。</strong> 添加阶段和任务后即可激活。`);
        }}
      />
    </div>
  );
}

function NewRouteModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (route: RouteRecord) => void;
}) {
  const [name, setName] = useState("新的学习路线");
  const [job, setJob] = useState("Java 后端实习");
  const [start, setStart] = useState("2026-10-20");
  const [minutes, setMinutes] = useState(300);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate({
      id: Date.now(),
      name,
      job,
      status: "draft",
      days: 21,
      taskCount: 0,
      doneCount: 0,
      plannedMinutes: 0,
      forecast: "待确认",
      targetDate: "待确认",
      progress: 0,
      currentStage: "待确认",
      day: 0,
      startDate: start,
    });
    setName("新的学习路线");
    setJob("Java 后端实习");
    setStart("2026-10-20");
    setMinutes(300);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="新建空路线"
      subtitle="先创建结构，稍后在路线详情里添加阶段、周和任务"
    >
      <form className="modal__form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="new-route-name">路线名称</label>
          <input id="new-route-name" value={name} onChange={(event) => setName(event.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="new-route-job">目标岗位</label>
          <input id="new-route-job" value={job} onChange={(event) => setJob(event.target.value)} />
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="new-route-start">开始日期</label>
            <input id="new-route-start" type="date" value={start} onChange={(event) => setStart(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="new-route-minutes">每日可用分钟</label>
            <input
              id="new-route-minutes"
              type="number"
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
            />
          </div>
        </div>
        <div className="impact-box">
          <RouteIcon className="icon" aria-hidden="true" />
          <span>新路线以草稿状态创建，不会进入今日计划；添加任务并激活后才会开始生成每日任务。</span>
        </div>
        <div className="modal__foot">
          <Button variant="secondary" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" size="sm" type="submit">
            创建草稿
          </Button>
        </div>
      </form>
    </Modal>
  );
}
