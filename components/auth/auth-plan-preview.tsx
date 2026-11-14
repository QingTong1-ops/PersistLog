import { ArrowUpRight, Check, Clock3 } from "lucide-react";

const PREVIEW_TASKS = [
  { title: "JVM 内存区域", minutes: 50, done: true },
  { title: "HTTP 缓存", minutes: 45, done: false },
  { title: "项目接口联调", minutes: 60, done: false },
];

export function AuthPlanPreview() {
  return (
    <figure className="auth-preview" aria-label="产品示意：完成今日任务后，同步更新学习路线进度">
      <div className="auth-preview__caption">
        <span>产品示意</span>
        <span>计划 → 执行 → 进展</span>
      </div>
      <div className="auth-preview__card">
        <div className="auth-preview__header">
          <div>
            <span className="auth-preview__eyebrow">今日计划</span>
            <h2>Java 后端实习</h2>
          </div>
          <span className="auth-preview__count">3 项任务</span>
        </div>
        <div className="auth-preview__progress" aria-hidden="true">
          <span />
        </div>
        <ul className="auth-preview__tasks">
          {PREVIEW_TASKS.map((task) => (
            <li className={task.done ? "auth-preview__task is-done" : "auth-preview__task"} key={task.title}>
              <span className="auth-preview__check" aria-hidden="true">
                {task.done ? <Check /> : null}
              </span>
              <span className="auth-preview__task-title">{task.title}</span>
              <span className="auth-preview__time">
                <Clock3 aria-hidden="true" />
                {task.minutes} 分钟
              </span>
            </li>
          ))}
        </ul>
        <div className="auth-preview__route">
          <div className="auth-preview__route-head">
            <span>路线进度</span>
            <span>
              每次完成都有记录
              <ArrowUpRight aria-hidden="true" />
            </span>
          </div>
          <svg viewBox="0 0 360 48" fill="none" aria-hidden="true">
            <path className="auth-preview__route-base" d="M2 38L58 34L114 35L170 25L226 27L282 14L358 8" />
            <path className="auth-preview__route-value" pathLength="1" d="M2 38L58 34L114 35L170 25L226 27L282 14" />
            <circle className="auth-preview__route-dot" cx="282" cy="14" r="4" />
          </svg>
        </div>
      </div>
    </figure>
  );
}
