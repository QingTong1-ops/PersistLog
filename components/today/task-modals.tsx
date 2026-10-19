"use client";

import { useState, type FormEvent } from "react";
import { Info, Plus, RefreshCw, Settings, Target } from "lucide-react";
import { Button, ConfirmDialog, Modal } from "@/components/ui";
import type { NewTaskInput, Task, TaskType } from "@/lib/types";

const TASK_TYPES: TaskType[] = ["算法", "八股", "工程", "项目", "简历", "面试", "复盘"];

function Foot({ onClose, submitLabel }: { onClose: () => void; submitLabel: string }) {
  return (
    <div className="modal__foot">
      <Button variant="secondary" size="sm" onClick={onClose}>
        取消
      </Button>
      <Button variant="primary" size="sm" type="submit">
        {submitLabel}
      </Button>
    </div>
  );
}

export function CompleteTaskModal({
  task,
  onClose,
  onSubmit,
}: {
  task: Task;
  onClose: () => void;
  onSubmit: (actual: number, note: string) => void;
}) {
  const [actual, setActual] = useState(task.actual || task.planned);
  const [note, setNote] = useState(task.note);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(actual, note);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="完成任务"
      subtitle={`${task.title} · 计划 ${task.planned} 分钟`}
    >
      <form className="modal__form" onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="complete-actual">
              实际用时 <small>分钟</small>
            </label>
            <input
              id="complete-actual"
              type="number"
              min={0}
              max={600}
              value={actual}
              onChange={(event) => setActual(Number(event.target.value))}
            />
          </div>
          <div className="field">
            <label>计划时长</label>
            <input value={`${task.planned} 分钟`} disabled />
          </div>
        </div>
        <div className="field">
          <label htmlFor="complete-note">
            备注 <small>可选</small>
          </label>
          <textarea
            id="complete-note"
            value={note}
            placeholder="记录卡点、产出位置或下一步"
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        <div className="impact-box">
          <Info className="icon" aria-hidden="true" />
          <span>
            完成后：路线进度会立即更新，今日完成度和容量条同步变化。预计完成日期按当前吞吐重新计算。
          </span>
        </div>
        <Foot onClose={onClose} submitLabel="确认完成" />
      </form>
    </Modal>
  );
}

export function PostponeModal({
  task,
  onClose,
  onSubmit,
}: {
  task: Task;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("今天时间不够");
  return (
    <Modal
      open
      onClose={onClose}
      title="延期到明天"
      subtitle={`${task.title} · 今天不再出现，明天作为顺延任务进入计划`}
    >
      <form
        className="modal__form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(reason);
        }}
      >
        <div className="field">
          <label htmlFor="postpone-reason">
            原因 <small>可选，仅自己可见</small>
          </label>
          <select
            id="postpone-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          >
            <option>今天时间不够</option>
            <option>优先级发生变化</option>
            <option>身体状态不适合</option>
            <option>还在等资料 / 反馈</option>
            <option>其他</option>
          </select>
        </div>
        <div className="impact-box">
          <Info className="icon" aria-hidden="true" />
          <span>
            明天会创建新的 occurrence，<b>顺延次数 +1</b>；预计完成日期由 11/12 变为{" "}
            <b>11/13</b>。连续顺延 3 次会提示拆分或放弃。
          </span>
        </div>
        <Foot onClose={onClose} submitLabel="确认延期" />
      </form>
    </Modal>
  );
}

export function SkipModal({
  task,
  onClose,
  onSubmit,
}: {
  task: Task;
  onClose: () => void;
  onSubmit: (reason: string, note: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title="跳过任务"
      subtitle={`${task.title} · 跳过需要写原因，任务计划日期会被清空`}
    >
      <form
        className="modal__form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!reason) return;
          onSubmit(reason, note);
        }}
      >
        <div className="field">
          <label htmlFor="skip-reason">
            原因 <small>必填</small>
          </label>
          <select
            id="skip-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          >
            <option value="">请选择</option>
            <option>内容已不适合当前目标</option>
            <option>时间安排冲突</option>
            <option>已经掌握，不需要再做</option>
            <option>任务描述有问题</option>
            <option>其他</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="skip-note">
            补充说明 <small>可选</small>
          </label>
          <textarea
            id="skip-note"
            value={note}
            placeholder="例如：已通过项目实践掌握该知识点"
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        <div className="impact-box">
          <Info className="icon" aria-hidden="true" />
          <span>
            跳过会计入计划分母但不计完成，因此完成率可能下降。任务不会自动进入明天，可在路线详情重新排期。
          </span>
        </div>
        <Foot onClose={onClose} submitLabel="确认跳过" />
      </form>
    </Modal>
  );
}

export function BlockModal({
  task,
  onClose,
  onSubmit,
}: {
  task: Task;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState(task.blockReason ?? "");
  return (
    <Modal
      open
      onClose={onClose}
      title="标记阻塞"
      subtitle={`${task.title} · 阻塞不会自动解除，也不会被静默丢弃`}
    >
      <form
        className="modal__form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!reason.trim()) return;
          onSubmit(reason);
        }}
      >
        <div className="field">
          <label htmlFor="block-reason">
            阻塞原因 <small>必填</small>
          </label>
          <textarea
            id="block-reason"
            value={reason}
            placeholder="例如：等待导师确认缓存分层方案"
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <div className="impact-box">
          <Info className="icon" aria-hidden="true" />
          <span>
            阻塞任务仍会进入明天的计划并保持阻塞状态；解除后恢复为待开始。连续阻塞不会自动降级。
          </span>
        </div>
        <Foot onClose={onClose} submitLabel="确认阻塞" />
      </form>
    </Modal>
  );
}

export function SplitModal({
  task,
  onClose,
  onSubmit,
}: {
  task: Task;
  onClose: () => void;
  onSubmit: (title1: string, minutes1: number, title2: string, minutes2: number) => void;
}) {
  const half = Math.max(15, Math.round(task.planned / 2));
  const [title1, setTitle1] = useState(`${task.title} · 第一部分`);
  const [title2, setTitle2] = useState(`${task.title} · 第二部分`);
  const [minutes1, setMinutes1] = useState(half);
  const [minutes2, setMinutes2] = useState(Math.max(15, task.planned - half));

  return (
    <Modal
      open
      onClose={onClose}
      title="拆分为两项"
      subtitle={`${task.title} · 拆分后原任务归档，新任务进入今日`}
    >
      <form
        className="modal__form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(title1, minutes1, title2, minutes2);
        }}
      >
        <div className="field">
          <label htmlFor="split-title-1">子任务 1</label>
          <input
            id="split-title-1"
            value={title1}
            onChange={(event) => setTitle1(event.target.value)}
            required
          />
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="split-minutes-1">预计分钟</label>
            <input
              id="split-minutes-1"
              type="number"
              min={15}
              max={120}
              value={minutes1}
              onChange={(event) => setMinutes1(Number(event.target.value))}
            />
          </div>
          <div className="field">
            <label>原任务时长</label>
            <input value={`${task.planned} 分钟`} disabled />
          </div>
        </div>
        <div className="field">
          <label htmlFor="split-title-2">子任务 2</label>
          <input
            id="split-title-2"
            value={title2}
            onChange={(event) => setTitle2(event.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="split-minutes-2">预计分钟</label>
          <input
            id="split-minutes-2"
            type="number"
            min={15}
            max={120}
            value={minutes2}
            onChange={(event) => setMinutes2(Number(event.target.value))}
          />
        </div>
        <div className="impact-box">
          <Info className="icon" aria-hidden="true" />
          <span>
            拆分适合超过 70 分钟或连续顺延的任务。两个子任务都会继承原任务的阶段、产出和验收标准。
          </span>
        </div>
        <Foot onClose={onClose} submitLabel="确认拆分" />
      </form>
    </Modal>
  );
}

export function AbandonTaskDialog({
  task,
  onClose,
  onConfirm,
}: {
  task: Task;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title="放弃任务"
      subtitle={task.title}
      body={
        <p>
          放弃后任务会归档，<strong>不计入完成率分母</strong>，历史执行记录仍然保留。这个操作在正式版应支持撤销。
        </p>
      }
      confirmText="确认放弃"
      onConfirm={onConfirm}
    />
  );
}

export function AddTaskModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: NewTaskInput) => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TaskType>("复盘");
  const [minutes, setMinutes] = useState(30);
  const [output, setOutput] = useState("");
  const [acceptance, setAcceptance] = useState("");

  return (
    <Modal open onClose={onClose} title="添加今日任务" subtitle="手动加入的任务也会占用今日容量，并进入执行统计">
      <form
        className="modal__form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) return;
          onSubmit({ title: title.trim(), type, planned: minutes, output, acceptance });
        }}
      >
        <div className="field">
          <label htmlFor="add-title">任务标题</label>
          <input
            id="add-title"
            value={title}
            placeholder="例如：复盘今天的面试问题"
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="add-type">类型</label>
            <select id="add-type" value={type} onChange={(event) => setType(event.target.value as TaskType)}>
              {TASK_TYPES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="add-minutes">预计分钟</label>
            <input
              id="add-minutes"
              type="number"
              min={15}
              max={120}
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="add-output">产出要求</label>
          <input
            id="add-output"
            value={output}
            placeholder="例如：一页复盘笔记"
            onChange={(event) => setOutput(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="add-acceptance">验收标准</label>
          <textarea
            id="add-acceptance"
            value={acceptance}
            placeholder="例如：能讲清 3 个问题的改进点"
            onChange={(event) => setAcceptance(event.target.value)}
          />
        </div>
        <div className="impact-box">
          <Info className="icon" aria-hidden="true" />
          <span>添加后会立即出现在今日任务中。若超出容量，会标记为 over_capacity，但不会静默丢弃。</span>
        </div>
        <Foot onClose={onClose} submitLabel="添加任务" />
      </form>
    </Modal>
  );
}

export function AdjustPlanModal({
  onClose,
  onAdd,
  onRegenerate,
  onOpenSettings,
}: {
  onClose: () => void;
  onAdd: () => void;
  onRegenerate: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <Modal open onClose={onClose} title="调整今日计划" subtitle="今日计划由容量和优先级自动生成，也可以手动补充">
      <div className="impact-box" style={{ marginBottom: 14 }}>
        <Target className="icon" aria-hidden="true" />
        <span>
          有效容量 <b>240 分钟</b> · 已排入 <b>220 分钟</b> · 剩余缓冲 <b>20 分钟</b>。不建议再加超过
          20 分钟的任务。
        </span>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <Button variant="secondary" size="sm" onClick={onAdd} style={{ justifyContent: "flex-start" }}>
          <Plus className="icon" aria-hidden="true" />
          手动添加一项任务
        </Button>
        <Button variant="secondary" size="sm" onClick={onRegenerate} style={{ justifyContent: "flex-start" }}>
          <RefreshCw className="icon" aria-hidden="true" />
          重新生成今日计划
        </Button>
        <Button variant="secondary" size="sm" onClick={onOpenSettings} style={{ justifyContent: "flex-start" }}>
          <Settings className="icon" aria-hidden="true" />
          调整每日容量
        </Button>
      </div>
      <div className="modal__foot">
        <Button variant="ghost" size="sm" onClick={onClose}>
          关闭
        </Button>
      </div>
    </Modal>
  );
}


