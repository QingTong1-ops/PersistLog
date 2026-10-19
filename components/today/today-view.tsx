"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  LayoutGrid,
  Play,
  Plus,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import {
  Button,
  EmptyState,
  PageHeader,
  ProgressRing,
} from "@/components/ui";
import { TaskRow } from "@/components/today/task-row";
import { TaskDetailSheet, type TaskAction } from "@/components/today/task-detail-sheet";
import {
  AbandonTaskDialog,
  AddTaskModal,
  AdjustPlanModal,
  BlockModal,
  CompleteTaskModal,
  PostponeModal,
  SkipModal,
  SplitModal,
} from "@/components/today/task-modals";
import { useAppStore } from "@/lib/store/app-store";
import { useToast } from "@/components/ui";
import { EFFECTIVE_CAPACITY, DEMO_USER } from "@/lib/mock-data";
import { cn, taskStats } from "@/lib/utils";

type Filter = "all" | "pending" | "done";
type ModalKind =
  | "complete"
  | "postpone"
  | "skip"
  | "block"
  | "split"
  | "abandon"
  | "add"
  | "adjust"
  | null;

export function TodayView({ demoState }: { demoState?: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const {
    tasks,
    completeAll,
    clearToday,
    startTask,
    completeTask,
    postponeTask,
    skipTask,
    blockTask,
    unblockTask,
    restoreTask,
    abandonTask,
    splitTask,
    addTask,
    routePercent: routeProgress,
    routeDone,
  } = useAppStore();

  const [filter, setFilter] = useState<Filter>("all");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [modalTaskId, setModalTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (demoState === "done") completeAll();
    if (demoState === "empty") clearToday();
  }, [demoState, completeAll, clearToday]);

  const stats = useMemo(() => taskStats(tasks), [tasks]);
  const nextTask = useMemo(
    () => tasks.find((task) => ["pending", "in_progress", "blocked"].includes(task.status)),
    [tasks]
  );
  const activeTask = tasks.find((task) => task.id === activeTaskId) ?? null;
  const modalTask = tasks.find((task) => task.id === modalTaskId) ?? null;
  const allDone = stats.considered.length > 0 && stats.completed.length === stats.considered.length;

  const filteredTasks = useMemo(() => {
    if (filter === "pending") {
      return stats.considered.filter((task) =>
        ["pending", "in_progress", "blocked"].includes(task.status)
      );
    }
    if (filter === "done") return stats.completed;
    return stats.considered;
  }, [filter, stats]);

  const buffer = stats.buffer;
  const scale = Math.max(EFFECTIVE_CAPACITY, stats.plannedTotal);
  const bufferCopy =
    buffer >= EFFECTIVE_CAPACITY
      ? "分钟可用 · 今天还没有任务"
      : buffer >= 0
        ? "分钟缓冲 · 不建议再加任务"
        : "分钟超容量 · 建议拆分或移出任务";

  const heroTitle = !stats.considered.length
    ? "今天没有安排任务。"
    : allDone
      ? "今天的计划已经完成。"
      : nextTask?.status === "blocked"
        ? `「${nextTask.title}」仍在阻塞，先解除阻塞再继续。`
        : nextTask
          ? `先把「${nextTask.title}」做掉，今天就能回到节奏里。`
          : "今天的计划已经完成。";

  const heroSub = !stats.considered.length
    ? "可以从路线添加任务，或导入一份新的 Markdown 计划。"
    : allDone
      ? `${stats.considered.length} 项全部完成，累计活跃天数 +1。可以提前看明天，或把时间留给复盘。`
      : `有效容量 ${EFFECTIVE_CAPACITY} 分钟 · 已排入 ${stats.plannedTotal} 分钟 · ${
          buffer >= 0 ? `剩余缓冲 ${buffer} 分钟` : `超出容量 ${Math.abs(buffer)} 分钟`
        }`;

  function openModal(kind: ModalKind, taskId: string | null = null) {
    setModalTaskId(taskId);
    setActiveTaskId(null);
    setModal(kind);
  }

  function closeModal() {
    setModal(null);
    setModalTaskId(null);
  }

  function handleCheck(taskId: string) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    if (["pending", "in_progress"].includes(task.status)) {
      openModal("complete", task.id);
    } else {
      setActiveTaskId(task.id);
    }
  }

  function handleDetailAction(action: TaskAction) {
    if (!activeTask) return;
    const id = activeTask.id;
    if (action === "start") {
      const task = startTask(id);
      setActiveTaskId(null);
      if (task) showToast(`<strong>开始「${task.title}」</strong> 完成后记得填写实际分钟。`);
      return;
    }
    if (action === "complete" || action === "postpone" || action === "skip" || action === "block" || action === "split" || action === "abandon") {
      openModal(action, id);
      return;
    }
    if (action === "unblock") {
      const task = tasks.find((item) => item.id === id);
      unblockTask(id);
      setActiveTaskId(null);
      if (task) showToast(`<strong>已解除阻塞。</strong>「${task.title}」恢复为待开始。`);
      return;
    }
    if (action === "restore") {
      const task = tasks.find((item) => item.id === id);
      restoreTask(id);
      setActiveTaskId(null);
      if (task) showToast(`<strong>已恢复到今日。</strong>「${task.title}」重新进入待完成。`);
    }
  }

  function handleComplete(actual: number, note: string) {
    if (!modalTask) return;
    const result = completeTask(modalTask.id, actual, note);
    closeModal();
    if (!result) return;
    if (result.allDone) {
      showToast(
        <>
          <strong>今天的计划已完成。</strong> 路线进度 {result.beforePercent}% →{" "}
          {result.afterPercent}%，累计活跃天数 +1。
        </>
      );
    } else {
      showToast(
        <>
          <strong>已完成「{result.task.title}」</strong> 路线进度 {result.beforePercent}% →{" "}
          {result.afterPercent}%，预计完成日 11/12。
        </>
      );
    }
  }

  return (
    <div className="view">
      <PageHeader
        eyebrow="Today · 2026 年 10 月 19 日 周一"
        title="今天先做什么？"
        description="计划已经排好。今天只需要确认、执行和记录，不用重新整理待办。"
        side={
          <span className="goal-pill">
            <i />
            {DEMO_USER.goal} · 距目标 22 天
          </span>
        }
      />

      <section className="focus-hero" aria-labelledby="hero-title">
        <div className="hero-left">
          <ProgressRing
            percent={stats.percent}
            label="今日完成"
            className="hero-ring"
          />
          <div className="hero-copy">
            <span className="eyebrow eyebrow--light">Monday focus</span>
            <h2 id="hero-title">{heroTitle}</h2>
            <p>{heroSub}</p>
            <div className="hero-metrics">
              <div className="hero-metric">
                <strong>
                  {stats.completed.length} / {stats.considered.length}
                </strong>
                <span>任务完成</span>
              </div>
              <div className="hero-metric">
                <strong>{stats.carry.length}</strong>
                <span>项自动顺延</span>
              </div>
              <div className="hero-metric">
                <strong>12 天</strong>
                <span>累计活跃</span>
              </div>
            </div>
          </div>
        </div>
        <div className="hero-actions">
          <Button
            variant="light"
            onClick={() => {
              if (!tasks.length) {
                showToast("<strong>今天没有任务。</strong> 可以导入一份计划，或从路线添加一项任务。", "risk");
                return;
              }
              if (!nextTask) {
                showToast("<strong>今天的任务已经全部完成。</strong> 可以查看明天的安排，或提前做一项。");
                return;
              }
              setActiveTaskId(nextTask.id);
            }}
          >
            <Play className="icon" aria-hidden="true" />
            开始下一项
          </Button>
          <Button variant="on-dark" onClick={() => openModal("adjust")}>
            调整计划
          </Button>
        </div>
      </section>

      <section className="capacity-card" aria-label="今日容量">
        <div>
          <p className="capacity-card__label">今日容量</p>
          <p className="capacity-card__value">
            <b>{stats.plannedTotal}</b> / {EFFECTIVE_CAPACITY} 分钟已排入
          </p>
        </div>
        <div className="capacity-card__bar">
          <div
            className="capacity-bar"
            role="img"
            aria-label={`已完成 ${stats.completedPlanned} 分钟，待完成 ${stats.remainingPlanned} 分钟，缓冲 ${Math.max(0, buffer)} 分钟`}
          >
            <span
              className="capacity-bar__done"
              style={{ width: `${(stats.completedPlanned / scale) * 100}%` }}
            />
            <span
              className="capacity-bar__planned"
              style={{ width: `${(stats.remainingPlanned / scale) * 100}%` }}
            />
            <span
              className="capacity-bar__buffer"
              style={{ width: `${(Math.max(0, buffer) / scale) * 100}%` }}
            />
          </div>
          <div className="capacity-legend">
            <span>
              <i style={{ background: "var(--teal-600)" }} />
              已完成 <b>{stats.completedPlanned} 分钟</b>
            </span>
            <span>
              <i style={{ background: "#c7c8f0" }} />
              待完成 <b>{stats.remainingPlanned} 分钟</b>
            </span>
            <span>
              <i style={{ background: "#eef0f7" }} />
              缓冲 <b>{Math.max(0, buffer)} 分钟</b>
            </span>
          </div>
        </div>
        <div className="capacity-card__buffer">
          <b>{Math.max(0, buffer)}</b>
          <span>{bufferCopy}</span>
        </div>
      </section>

      <div className="today-grid">
        <div className="stack">
          {stats.carry.length ? (
            <section className="card carry-card">
              <div className="carry-card__body">
                <span className="carry-icon">
                  <RefreshCw className="icon" aria-hidden="true" />
                </span>
                <div className="carry-copy">
                  <strong>
                    {stats.carry.length} 项任务从昨天顺延 · 连续顺延{" "}
                    {Math.max(...stats.carry.map((task) => task.carry))} 次
                  </strong>
                  <span>
                    {stats.carry[0].title} · {stats.carry[0].planned} 分钟 · 今天优先做
                  </span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setActiveTaskId(stats.carry[0].id)}
                >
                  优先开始
                </Button>
              </div>
            </section>
          ) : null}

          <section className="card" aria-labelledby="today-tasks-title">
            <div className="card__head">
              <div>
                <h2 id="today-tasks-title">
                  今日任务{" "}
                  <span className="faint" style={{ fontSize: 10, fontWeight: 500 }}>
                    {stats.completed.length} / {stats.considered.length} 已完成
                  </span>
                </h2>
                <p>点击任务查看产出、验收标准和状态操作。</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => openModal("add")}>
                <Plus className="icon" aria-hidden="true" />
                添加任务
              </Button>
            </div>

            <div className="tabs" role="tablist" aria-label="任务筛选">
              {[
                { value: "all" as const, label: "全部", count: stats.considered.length },
                { value: "pending" as const, label: "待完成", count: stats.pending.length },
                { value: "done" as const, label: "已完成", count: stats.completed.length },
              ].map((tab) => (
                <button
                  key={tab.value}
                  className={cn("tab", filter === tab.value && "is-active")}
                  type="button"
                  role="tab"
                  aria-selected={filter === tab.value}
                  onClick={() => setFilter(tab.value)}
                >
                  {tab.label} <span className="tab__count">{tab.count}</span>
                </button>
              ))}
            </div>

            <div className="task-list">
              {filteredTasks.length ? (
                filteredTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onOpen={() => setActiveTaskId(task.id)}
                    onCheck={() => handleCheck(task.id)}
                  />
                ))
              ) : (
                <EmptyState
                  icon={<LayoutGrid className="icon" aria-hidden="true" />}
                  title={
                    filter === "done"
                      ? "还没有已完成的任务"
                      : filter === "pending"
                        ? "待完成任务已清空"
                        : "今天没有任务"
                  }
                  description={
                    filter === "done"
                      ? "完成一项后，这里会记录实际分钟和路线影响。"
                      : "从路线添加任务，或导入一份 Markdown 计划。"
                  }
                  actions={
                    <>
                      <Button variant="primary" size="sm" onClick={() => openModal("add")}>
                        添加任务
                      </Button>
                      <Link className="btn btn--secondary btn--sm" href="/routes/1">
                        从路线添加
                      </Link>
                    </>
                  }
                />
              )}
            </div>

            <div className="card__foot">
              <span>完成任务后，路线进度和预计完成日期会立即更新。</span>
              <Link className="card__link" href="/routes/1">
                查看路线
                <ChevronRight className="icon" aria-hidden="true" />
              </Link>
            </div>
          </section>

          <section className="card" aria-labelledby="next-title">
            <div className="card__head">
              <div>
                <h2 id="next-title">接下来</h2>
                <p>明天与今晚的固定动作。</p>
              </div>
            </div>
            <div className="next-card__body">
              <div className="next-item">
                <span className="next-date">10/20</span>
                <p>区间 DP：3 道中等题</p>
                <b>60 分钟</b>
              </div>
              <div className="next-item">
                <span className="next-date">10/20</span>
                <p>JVM 垃圾收集器复盘</p>
                <b>35 分钟</b>
              </div>
              <div className="next-item">
                <span className="next-date">今晚</span>
                <p>20:30 晚报：汇总完成与顺延</p>
                <b>企微</b>
              </div>
            </div>
          </section>
        </div>

        <aside className="stack">
          <section className="push-card" aria-labelledby="push-title">
            <div className="push-head">
              <span className="push-title">WeCom · 已连接</span>
              <span className="push-icon">
                <Bell className="icon" aria-hidden="true" />
              </span>
            </div>
            <h3 id="push-title">今日早报已送达</h3>
            <p>07:30 已推送 {stats.considered.length} 项任务，预计 3 小时 40 分。晚报会在 20:30 汇总完成情况。</p>
            <div className="push-preview">
              【恒序 · 今日】10/19 周一
              <br />
              今日 {stats.considered.length} 项，预计 3h40m
              <br />
              重点：缓存方案 + JVM 三问
              <br />
              <b>完成 2/5 即达标</b>
            </div>
            <div className="push-status">
              <i />
              <span>企业微信群机器人运行正常</span>
              <Link className="card__link" href="/settings/notifications">
                设置
              </Link>
            </div>
          </section>

          <section className="card" aria-labelledby="summary-title">
            <div className="card__head">
              <div>
                <h2 id="summary-title">执行摘要</h2>
                <p>近 7 天与当前路线。</p>
              </div>
              <Link className="card__link" href="/dashboard">
                看板
              </Link>
            </div>
            <div className="summary-list">
              <div className="summary-row">
                <span>近 7 天完成率</span>
                <b className="text-good">74% · 28/38</b>
              </div>
              <div className="summary-row">
                <span>计划 / 实际分钟</span>
                <b>620 / 578</b>
              </div>
              <div className="summary-row">
                <span>顺延任务</span>
                <b className="text-warn">5 项 · 13%</b>
              </div>
              <div className="summary-row">
                <span>路线进度</span>
                <b>
                  {routeProgress}% · {routeDone}/42
                </b>
              </div>
            </div>
          </section>

          <section className="card" aria-labelledby="insight-title">
            <div className="card__head">
              <div>
                <h2 id="insight-title">执行提示</h2>
                <p>基于当前计划状态的规则提示，不是 AI 评分。</p>
              </div>
            </div>
            <div className="insight-list">
              {stats.carry.length ? (
                <div className="insight insight--warn">
                  <TriangleAlert className="icon" aria-hidden="true" />
                  <span>
                    {stats.carry.length} 项任务从昨天顺延。连续顺延 3 次会提示拆分、降级或放弃，避免一项任务拖住整条路线。
                  </span>
                </div>
              ) : null}
              <div className="insight insight--good">
                <CheckCircle2 className="icon" aria-hidden="true" />
                <span>本周已活跃 3 天。今晚 20:30 晚报会汇总未完成项和新的预计完成日期。</span>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <section className="card forecast-card" aria-labelledby="forecast-title">
        <div className="card__head">
          <div>
            <h2 id="forecast-title">
              路线预测{" "}
              <span className="faint" style={{ fontSize: 10, fontWeight: 500 }}>
                第 18 / 36 天
              </span>
            </h2>
            <p>按当前剩余工作量和近期吞吐估算，不使用主观能力评分。</p>
          </div>
          <Link className="card__link" href="/routes/1">
            查看路线
          </Link>
        </div>
        <div className="forecast-grid">
          <div>
            <div className="forecast-date">
              11 月 12 日<span>预计完成当前 Java 后端准备路线</span>
            </div>
            <span className="status status--risk forecast-flag">晚于目标 2 天</span>
          </div>
          <div className="timeline" aria-label="路线阶段">
            <div className="timeline-step is-done">
              <div className="timeline-dot" />
              <div className="timeline-label">基础夯实</div>
            </div>
            <div className="timeline-step is-done">
              <div className="timeline-dot" />
              <div className="timeline-label">算法与八股</div>
            </div>
            <div className="timeline-step is-current">
              <div className="timeline-dot" />
              <div className="timeline-label">工程与项目</div>
            </div>
            <div className="timeline-step">
              <div className="timeline-dot" />
              <div className="timeline-label">简历与冲刺</div>
            </div>
          </div>
          <div className="forecast-risk">
            <strong>
              <TriangleAlert className="icon" aria-hidden="true" />
              目标日 11/10，预测晚 2 天
            </strong>
            <p>剩余 16 项 / 约 18.5 小时。本周容量已接近上限，建议优先顺延任务，或拆分 1 项工程任务。</p>
          </div>
        </div>
      </section>

      <TaskDetailSheet
        task={activeTask}
        open={Boolean(activeTask)}
        onClose={() => setActiveTaskId(null)}
        onAction={handleDetailAction}
      />

      {modal === "complete" && modalTask ? (
        <CompleteTaskModal task={modalTask} onClose={closeModal} onSubmit={handleComplete} />
      ) : null}
      {modal === "postpone" && modalTask ? (
        <PostponeModal
          task={modalTask}
          onClose={closeModal}
          onSubmit={(reason) => {
            postponeTask(modalTask.id, reason);
            closeModal();
            showToast("<strong>已延期到明天。</strong> 预计完成日期 11/13（+1 天）；连续顺延 3 次会提示拆分。");
          }}
        />
      ) : null}
      {modal === "skip" && modalTask ? (
        <SkipModal
          task={modalTask}
          onClose={closeModal}
          onSubmit={(reason, note) => {
            skipTask(modalTask.id, reason, note);
            closeModal();
            showToast("<strong>已跳过。</strong> 任务计划日期已清空，不再自动进入今日；可在路线详情重新排期。");
          }}
        />
      ) : null}
      {modal === "block" && modalTask ? (
        <BlockModal
          task={modalTask}
          onClose={closeModal}
          onSubmit={(reason) => {
            blockTask(modalTask.id, reason);
            closeModal();
            showToast("<strong>已标记阻塞。</strong> 解除后恢复为待开始；阻塞任务仍会进入明天的计划。");
          }}
        />
      ) : null}
      {modal === "split" && modalTask ? (
        <SplitModal
          task={modalTask}
          onClose={closeModal}
          onSubmit={(title1, minutes1, title2, minutes2) => {
            splitTask(modalTask.id, [
              { title: title1, minutes: minutes1 },
              { title: title2, minutes: minutes2 },
            ]);
            closeModal();
            showToast("<strong>已拆分为两项。</strong> 原任务归档，两个子任务已进入今日。");
          }}
        />
      ) : null}
      {modal === "abandon" && modalTask ? (
        <AbandonTaskDialog
          task={modalTask}
          onClose={closeModal}
          onConfirm={() => {
            abandonTask(modalTask.id);
            closeModal();
            showToast("<strong>已放弃任务。</strong> 任务已归档，不计入完成率。", "risk");
          }}
        />
      ) : null}
      {modal === "add" ? (
        <AddTaskModal
          onClose={closeModal}
          onSubmit={(input) => {
            const task = addTask(input);
            closeModal();
            showToast(`<strong>已添加「${task.title}」</strong> 今日容量已重新计算。`);
          }}
        />
      ) : null}
      {modal === "adjust" ? (
        <AdjustPlanModal
          onClose={closeModal}
          onAdd={() => {
            closeModal();
            setModal("add");
          }}
          onRegenerate={() => {
            closeModal();
            showToast("<strong>已按当前容量和优先级重新生成今日计划。</strong> 已有执行记录不会丢失。");
          }}
          onOpenSettings={() => {
            closeModal();
            router.push("/settings/profile");
          }}
        />
      ) : null}
    </div>
  );
}


