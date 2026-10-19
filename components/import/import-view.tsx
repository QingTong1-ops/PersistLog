"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import {
  CheckCircle2,
  Download,
  FileText,
  Info,
  Shield,
  TriangleAlert,
  Upload,
} from "lucide-react";
import {
  Button,
  ConfirmDialog,
  Modal,
  PageHeader,
  Tag,
  useToast,
} from "@/components/ui";
import { PREVIEW_TASKS, TEMPLATE_MARKDOWN } from "@/lib/mock-data";
import type { PreviewTask, TaskType } from "@/lib/types";

type ImportPane = "empty" | "processing" | "preview" | "error" | "done";

const STAGES = [
  {
    title: "阶段一 · 基础夯实",
    meta: "12 任务 · 10/20 – 10/30",
    weeks: [
      { title: "第 1 周 · 网络基础", ids: [1, 2, 4] },
      { title: "第 2 周 · JVM 与集合", ids: [5, 6] },
    ],
  },
  {
    title: "阶段二 · 算法强化",
    meta: "14 任务 · 10/31 – 11/13",
    weeks: [
      { title: "第 3 周 · 树与图", ids: [7, 3] },
      { title: "第 4 周 · 动态规划", ids: [8, 9] },
    ],
  },
  {
    title: "阶段三 · 工程与项目",
    meta: "16 任务 · 11/14 – 11/30",
    weeks: [
      { title: "第 5 周 · 缓存与订单", ids: [10, 11] },
      { title: "第 6 周 · 简历与模拟面试", ids: [12, 13, 14], more: true },
    ],
  },
];

function clonePreview() {
  return JSON.parse(JSON.stringify(PREVIEW_TASKS)) as Record<number, PreviewTask>;
}

export function ImportView({ demoState }: { demoState?: string }) {
  const { showToast } = useToast();
  const [pane, setPane] = useState<ImportPane>("empty");
  const [consent, setConsent] = useState(false);
  const [fileName, setFileName] = useState("后端冲刺计划.md");
  const [progress, setProgress] = useState(5);
  const [step, setStep] = useState(0);
  const [previewTasks, setPreviewTasks] = useState<Record<number, PreviewTask>>(clonePreview);
  const [showMore, setShowMore] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<number | null>(null);
  const finishRef = useRef<number | null>(null);

  useEffect(() => {
    if (demoState === "preview") {
      setConsent(true);
      setPane("preview");
    } else if (demoState === "error") {
      setPane("error");
    } else if (demoState === "done") {
      setPane("done");
    } else {
      setPane("empty");
    }
  }, [demoState]);

  useEffect(
    () => () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      if (finishRef.current) window.clearTimeout(finishRef.current);
    },
    []
  );

  function stopTimers() {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    if (finishRef.current) window.clearTimeout(finishRef.current);
    intervalRef.current = null;
    finishRef.current = null;
  }

  function startProcessing(name = fileName) {
    if (!consent) {
      showToast("<strong>需要先授权。</strong> 首次导入前请勾选 AI 解析授权。", "risk");
      return;
    }
    stopTimers();
    setFileName(name);
    setPane("processing");
    setProgress(8);
    setStep(1);
    intervalRef.current = window.setInterval(() => {
      setStep((current) => {
        const next = Math.min(4, current + 1);
        setProgress([8, 32, 62, 88, 100][next] ?? 100);
        if (next >= 4) {
          if (intervalRef.current) window.clearInterval(intervalRef.current);
          intervalRef.current = null;
          finishRef.current = window.setTimeout(() => {
            setPane("preview");
            showToast("<strong>解析完成。</strong> 已生成 3 个阶段、6 个周目标、42 个任务，请检查问题清单。");
          }, 520);
        }
        return next;
      });
    }, 760);
  }

  function cancelProcessing() {
    stopTimers();
    setPane("empty");
    showToast("<strong>已取消解析。</strong> 没有创建任何路线。", "risk");
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    startProcessing(file.name);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.classList.remove("is-dragover");
    handleFile(event.dataTransfer.files?.[0]);
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_MARKDOWN], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "persistlog-plan-template.md";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("<strong>模板已下载。</strong> 按标题、列表和缩进填写，解析成功率最高。");
  }

  function savePreviewTask(task: PreviewTask) {
    setPreviewTasks((current) => ({ ...current, [task.id]: task }));
    setEditId(null);
    showToast("<strong>任务已更新。</strong> 问题清单会按新的验收标准重新判断。");
  }

  return (
    <div className="view">
      <PageHeader
        eyebrow="Import · Markdown only"
        title="导入一份计划"
        description="把你已有的学习计划变成可以每天执行的路线。Phase 1 只支持 Markdown；解析、校验和确认前都可取消。"
        side={
          <span className="goal-pill">
            <i />
            AI 只负责结构化与校验
          </span>
        }
      />

      <div className="import-layout">
        <section className="card upload-card">
          <div className="card__head">
            <div>
              <h2>上传计划</h2>
              <p>支持 .md / .markdown，UTF-8，单文件 ≤ 5MB。</p>
            </div>
          </div>

          <div
            className="dropzone"
            onDragEnter={(event) => {
              event.preventDefault();
              event.currentTarget.classList.add("is-dragover");
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.currentTarget.classList.add("is-dragover");
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              event.currentTarget.classList.remove("is-dragover");
            }}
            onDrop={onDrop}
          >
            <span className="dropzone__icon">
              <Upload className="icon" aria-hidden="true" />
            </span>
            <h2>拖入 Markdown 文件</h2>
            <p>也可以点击选择。解析后会先进入预览，不会直接创建路线。</p>
            <Button variant="primary" size="sm" onClick={() => fileRef.current?.click()}>
              选择文件
            </Button>
            <span className="dropzone__file">
              或{" "}
              <button className="card__link" type="button" onClick={() => startProcessing("后端冲刺计划.md")}>
                载入示例计划
              </button>
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".md,.markdown,text/markdown"
              hidden
              onChange={(event) => {
                handleFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>

          <div className={`consent-box ${consent ? "is-granted" : ""}`}>
            <div className="consent-head">
              <Shield className="icon" aria-hidden="true" />
              首次导入授权
            </div>
            <p>计划文本会发送给第三方 AI 做结构化。恒序只发送计划内容，不发送账号、简历或面试记录。</p>
            <label className="check-row">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
              />
              <span>
                我同意将计划文本用于 <code style={{ fontFamily: "var(--mono)", fontSize: 9 }}>ai_import</code>{" "}
                v1 解析
              </span>
            </label>
          </div>

          <div className="upload-note">
            <Info className="icon" aria-hidden="true" />
            <span>导入失败不会影响已有路线。确认后生成路线 v1；在产生执行记录前可回滚。</span>
          </div>
        </section>

        <section className="card import-panel" aria-live="polite">
          {pane === "empty" ? (
            <div className="import-pane">
              <div className="empty-state">
                <span className="empty-state__icon">
                  <FileText className="icon" aria-hidden="true" />
                </span>
                <h3>上传后在这里预览</h3>
                <p>会先展示阶段 / 周 / 任务树、问题清单和总容量。你可以逐项编辑，再确认创建路线。</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 16 }}>
                  <Button variant="primary" size="sm" onClick={() => startProcessing("后端冲刺计划.md")}>
                    载入示例计划
                  </Button>
                  <Button variant="secondary" size="sm" onClick={downloadTemplate}>
                    <Download className="icon" aria-hidden="true" />
                    下载 Markdown 模板
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {pane === "processing" ? (
            <div className="import-pane">
              <div className="import-pane__head">
                <div>
                  <h2>正在解析计划</h2>
                  <p>{fileName} · 上传完成</p>
                </div>
                <Tag variant="brand">Job 运行中</Tag>
              </div>
              <div className="processing-steps">
                {[
                  { title: "上传文件", detail: "已保存到本地存储" },
                  { title: "规则抽取", detail: "识别标题、列表、表格和日期" },
                  { title: "AI 标准化", detail: "补齐类型、时长、产出和验收标准" },
                  { title: "校验与容量检查", detail: "检查重复任务、单日容量和日期" },
                ].map((item, index) => {
                  const state = index === 0 || index < step ? "is-done" : index === step ? "is-active" : "";
                  return (
                    <div className={`processing-step ${state}`} key={item.title}>
                      <span className="step-dot">
                        {index === 0 || index < step ? (
                          <CheckCircle2 className="icon icon--sm" aria-hidden="true" />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.detail}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="processing-bar">
                <span style={{ width: `${progress}%` }} />
              </div>
              <div className="processing-meta">
                <span>job_01J9F3K2 · 可离开页面，稍后回来</span>
                <span>{progress}%</span>
              </div>
              <div className="preview-actions" style={{ margin: "18px -21px -22px", position: "static" }}>
                <span className="preview-actions__hint">解析通常需要 10–30 秒</span>
                <Button variant="secondary" size="sm" onClick={cancelProcessing}>
                  取消解析
                </Button>
              </div>
            </div>
          ) : null}

          {pane === "error" ? (
            <div className="import-pane">
              <div className="error-state">
                <span className="error-state__icon">
                  <TriangleAlert className="icon" aria-hidden="true" />
                </span>
                <h2>没有识别到可执行任务</h2>
                <p>
                  文件能读取，但没有找到任务列表或表格。请检查 Markdown 是否使用标题、无序列表或表格，或下载模板对照结构。
                </p>
                <span className="error-code">IMPORT_PARSE_FAILED · request_id 9f2c…</span>
                <div className="error-state__actions">
                  <Button variant="primary" size="sm" onClick={() => setPane("empty")}>
                    重新上传
                  </Button>
                  <Button variant="secondary" size="sm" onClick={downloadTemplate}>
                    下载模板
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {pane === "preview" ? (
            <>
              <div className="import-pane import-pane--preview">
                <div className="import-pane__head">
                  <div>
                    <h2>解析预览</h2>
                    <p>{fileName} · 已完成结构化，等待确认</p>
                  </div>
                  <div className="import-stats">
                    <span>
                      <b>3</b> 阶段
                    </span>
                    <span>
                      <b>6</b> 周
                    </span>
                    <span>
                      <b>42</b> 任务
                    </span>
                    <span>
                      <b>1,260</b> 分钟
                    </span>
                  </div>
                </div>

                <div className="issue-summary">
                  <span className="issue-chip issue-chip--error">
                    <b>0</b> 错误
                  </span>
                  <span className="issue-chip">
                    <b>2</b> 警告
                  </span>
                  <span className="issue-chip issue-chip--info">
                    <b>1</b> 提示
                  </span>
                  <span className="muted" style={{ fontSize: 9 }}>
                    错误会阻止确认；警告可逐项处理。
                  </span>
                </div>

                <div className="issue-list">
                  <div className="issue-item">
                    <TriangleAlert className="icon" aria-hidden="true" />
                    <p>
                      「第 4 周」的「完成 3 道中等题」缺少验收标准。AI 建议：能独立说明每道题的时间/空间复杂度。
                    </p>
                    <button className="issue-action" type="button" onClick={() => setEditId(3)}>
                      去编辑
                    </button>
                  </div>
                  <div className="issue-item">
                    <TriangleAlert className="icon" aria-hidden="true" />
                    <p>
                      检测到 2 个重复任务：「TCP 三次握手」在 10/20 和 10/21 各出现一次。请选择保留、合并或跳过。
                    </p>
                    <button
                      className="issue-action"
                      type="button"
                      onClick={() => showToast("<strong>已合并重复任务。</strong> 保留较早的一天，后一天标记为跳过。")}
                    >
                      合并
                    </button>
                  </div>
                  <div className="issue-item">
                    <Info className="icon" aria-hidden="true" />
                    <p>开始日期 10/02 早于今天。默认整体平移到今天，并保留历史任务为归档状态。</p>
                    <button
                      className="issue-action"
                      type="button"
                      onClick={() => showToast("<strong>已选择「整体平移到今天」。</strong> 未完成任务日期后移 17 天。")}
                    >
                      查看规则
                    </button>
                  </div>
                </div>

                <div className="preview-tree">
                  {STAGES.map((stage) => (
                    <div className="preview-stage" key={stage.title}>
                      <div className="preview-stage__title">
                        {stage.title} <span>{stage.meta}</span>
                      </div>
                      {stage.weeks.map((week) => {
                        if (week.more && !showMore) return null;
                        return (
                          <div key={week.title}>
                            <div className="preview-week">{week.title}</div>
                            {week.ids.map((id) => {
                              const task = previewTasks[id];
                              if (!task) return null;
                              return (
                                <div className="preview-task" key={id}>
                                  <span className="preview-task__title">
                                    {task.acceptance ? (
                                      <CheckCircle2 className="icon icon--ok" aria-hidden="true" />
                                    ) : (
                                      <TriangleAlert className="icon icon--warn" aria-hidden="true" />
                                    )}
                                    <span>{task.title}</span>
                                  </span>
                                  <b>{task.minutes} 分钟</b>
                                  <button
                                    className="preview-task__edit"
                                    type="button"
                                    onClick={() => setEditId(id)}
                                  >
                                    编辑
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <button
                    className="card__link preview-more"
                    type="button"
                    onClick={() => setShowMore((value) => !value)}
                  >
                    {showMore ? "收起多余任务" : "展开全部 42 项"}
                  </button>
                </div>
              </div>

              <div className="preview-actions">
                <span className="preview-actions__hint">确认后生成路线 v1 · 可在 24 小时内回滚</span>
                <div className="preview-actions__buttons">
                  <Button variant="ghost" size="sm" onClick={() => setPane("empty")}>
                    取消
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => startProcessing(fileName)}>
                    重新解析
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!consent}
                    onClick={() => {
                      setPane("done");
                      showToast("<strong>路线已创建。</strong> 42 个任务已进入路线 v1，可在 24 小时内回滚。");
                    }}
                  >
                    确认并创建路线
                  </Button>
                </div>
              </div>
            </>
          ) : null}

          {pane === "done" ? (
            <div className="import-pane">
              <div className="import-success">
                <span className="success-icon">
                  <CheckCircle2 className="icon" aria-hidden="true" />
                </span>
                <h2>路线已创建</h2>
                <p>42 个任务、6 个周目标、3 个阶段已进入路线。今日计划会在下一次生成时纳入这些任务。</p>
                <div className="import-success__stats">
                  <div>
                    <b>42</b>
                    <span>任务</span>
                  </div>
                  <div>
                    <b>3</b>
                    <span>阶段</span>
                  </div>
                  <div>
                    <b>6</b>
                    <span>周目标</span>
                  </div>
                  <div>
                    <b>v1</b>
                    <span>路线版本</span>
                  </div>
                </div>
                <div className="import-success__actions">
                  <Link className="btn btn--primary btn--sm" href="/routes/1">
                    查看路线
                  </Link>
                  <Button variant="secondary" size="sm" onClick={() => setRollbackOpen(true)}>
                    回滚本次导入
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPane("empty")}>
                    再导入一份
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {editId ? (
        <PreviewTaskEditModal
          task={previewTasks[editId]}
          onClose={() => setEditId(null)}
          onSave={savePreviewTask}
        />
      ) : null}

      <ConfirmDialog
        open={rollbackOpen}
        onClose={() => setRollbackOpen(false)}
        title="回滚本次导入"
        subtitle="后端冲刺计划.md · 路线 v1"
        body={
          <p>
            将删除本批次创建的路线、阶段、周和任务。如果已经产生执行记录，正式版会阻止回滚。
          </p>
        }
        confirmText="确认回滚"
        onConfirm={() => {
          setRollbackOpen(false);
          setPane("empty");
          showToast("<strong>已回滚本次导入。</strong> 已有路线和执行记录没有受到影响。", "risk");
        }}
      />
    </div>
  );
}

function PreviewTaskEditModal({
  task,
  onClose,
  onSave,
}: {
  task: PreviewTask;
  onClose: () => void;
  onSave: (task: PreviewTask) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [type, setType] = useState<TaskType>(task.type);
  const [minutes, setMinutes] = useState(task.minutes);
  const [output, setOutput] = useState(task.output);
  const [acceptance, setAcceptance] = useState(task.acceptance);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ ...task, title, type, minutes, output, acceptance });
  }

  return (
    <Modal open onClose={onClose} title="编辑预览任务" subtitle="确认前可以逐项修改；保存后问题清单会同步更新" wide>
      <form className="modal__form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="preview-title">任务标题</label>
          <input id="preview-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="preview-type">类型</label>
            <select id="preview-type" value={type} onChange={(event) => setType(event.target.value as TaskType)}>
              {(["算法", "八股", "工程", "项目", "简历", "面试", "复盘"] as TaskType[]).map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="preview-minutes">预计分钟</label>
            <input
              id="preview-minutes"
              type="number"
              min={15}
              max={120}
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="preview-output">产出要求</label>
          <input id="preview-output" value={output} onChange={(event) => setOutput(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="preview-acceptance">验收标准</label>
          <textarea
            id="preview-acceptance"
            value={acceptance}
            placeholder="能验证任务完成的客观标准"
            onChange={(event) => setAcceptance(event.target.value)}
          />
        </div>
        <div className="modal__foot">
          <Button variant="secondary" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" size="sm" type="submit">
            保存修改
          </Button>
        </div>
      </form>
    </Modal>
  );
}
