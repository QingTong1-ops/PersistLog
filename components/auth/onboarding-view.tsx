"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Info,
  Target,
  TriangleAlert,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button, Toggle, useToast } from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import { useAppStore } from "@/lib/store/app-store";
import { live } from "@/lib/api/live";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "档案与容量" },
  { id: 2, label: "求职目标" },
  { id: 3, label: "导入计划" },
  { id: 4, label: "企业微信" },
];

export function OnboardingView() {
  const router = useRouter();
  const { showToast } = useToast();
  const { status, user } = useAuth();
  const { refreshLive } = useAppStore();
  const [step, setStep] = useState(1);
  const [dailyMinutes, setDailyMinutes] = useState(300);
  const [factor, setFactor] = useState(80);
  const [fileName, setFileName] = useState("尚未选择文件");
  const [consent, setConsent] = useState(true);
  const [morning, setMorning] = useState(true);
  const [evening, setEvening] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [saving, setSaving] = useState(false);

  const effective = useMemo(
    () => Math.max(30, Math.floor((dailyMinutes * factor) / 100)),
    [dailyMinutes, factor]
  );

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login");
    }
  }, [router, status]);

  async function next() {
    if (step < 4) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (saving) return;
    setSaving(true);
    try {
      const value = (id: string) =>
        (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null)?.value ?? "";
      const targetDate = value("onb-target-date");
      const goal = value("onb-job") || "求职目标";

      await live.profile.update({
        display_name: user?.display_name || undefined,
        timezone: value("onb-timezone") || "Asia/Shanghai",
        daily_available_minutes: dailyMinutes,
        planning_capacity_factor: factor / 100,
        day_boundary_hour: Number(value("onb-boundary").slice(0, 2)) || 4,
      });

      const jobs = await live.profile.jobs();
      const primary = jobs.find((job) => job.is_primary && job.status === "active") ?? jobs[0];
      if (primary) {
        await live.profile.updateJob(primary.id, {
          title: goal,
          city: value("onb-city"),
          industry: value("onb-industry"),
          company_type: value("onb-company"),
          target_date: targetDate || undefined,
          priority: value("onb-priority") as "P0" | "P1" | "P2",
        });
      } else {
        await live.profile.createJob({
          title: goal,
          city: value("onb-city"),
          industry: value("onb-industry"),
          company_type: value("onb-company"),
          target_date: targetDate || undefined,
          priority: (value("onb-priority") || "P0") as "P0" | "P1" | "P2",
          is_primary: true,
        });
      }

      if (consent) {
        await live.profile.setConsent({ scope: "ai_import", version: "v1", granted: true });
      }

      await refreshLive();
      showToast("<strong>引导完成。</strong> 档案、目标与授权已保存，今日页已接入真实计划。");
      router.push("/today");
    } catch (cause) {
      showToast(
        `<strong>引导没有保存。</strong> ${cause instanceof Error ? cause.message : "后端请求失败"}`,
        "risk"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="onboarding-shell">
      <header className="onboarding-top">
        <Link className="brand" href="/onboarding" aria-label="恒序 persistLog">
          <BrandMark />
          <span>
            <span className="brand-name">恒序</span>
            <span className="brand-sub">persistLog</span>
          </span>
        </Link>
        <div className="onboarding-top__right">
          <span className="muted" style={{ fontSize: 10 }}>
            约 2 分钟
          </span>
          <Link className="btn btn--ghost btn--sm" href="/today">
            稍后再说
          </Link>
        </div>
      </header>

      <div className="stepper" aria-label="引导进度">
        {STEPS.map((item) => (
          <div
            key={item.id}
            className={cn(
              "stepper-step",
              step === item.id && "is-active",
              step > item.id && "is-done"
            )}
          >
            <span className="stepper-dot">
              {step > item.id ? <Check className="icon icon--sm" /> : item.id}
            </span>
            <p className="stepper-label">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="onboarding-grid">
        <section className="card onboarding-card">
          {step === 1 ? (
            <div className="onboarding-step">
              <span className="onboarding-step__eyebrow">Step 01 · 档案</span>
              <h1>先告诉恒序，你每天有多少时间。</h1>
              <p>这决定每日计划的上限。计划会留出缓冲，不把每一天排满。</p>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="onb-timezone">
                    时区 <small>用于计算“今天”</small>
                  </label>
                  <select id="onb-timezone" defaultValue="Asia/Shanghai">
                    <option value="Asia/Shanghai">Asia/Shanghai · 中国标准时间</option>
                    <option value="Asia/Tokyo">Asia/Tokyo · 日本标准时间</option>
                    <option value="Asia/Singapore">Asia/Singapore · 新加坡时间</option>
                    <option value="Europe/London">Europe/London · 伦敦时间</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="onb-boundary">
                    日界线 <small>默认 04:00</small>
                  </label>
                  <select id="onb-boundary" defaultValue="04:00">
                    <option value="04:00">04:00 · 推荐，熬夜也算今天</option>
                    <option value="00:00">00:00 · 自然日</option>
                    <option value="06:00">06:00</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="onb-minutes">
                    每日可投入时间 <small>分钟</small>
                  </label>
                  <input
                    id="onb-minutes"
                    type="number"
                    min={30}
                    max={720}
                    step={15}
                    value={dailyMinutes}
                    onChange={(event) => setDailyMinutes(Number(event.target.value) || 30)}
                  />
                  <p className="field__hint">包含学习、练习和复盘，不含通勤与休息。</p>
                </div>
                <div className="field">
                  <label htmlFor="onb-factor">
                    计划容量系数 <small>0.6–1.0</small>
                  </label>
                  <div className="range-row">
                    <input
                      id="onb-factor"
                      type="range"
                      min={60}
                      max={100}
                      step={5}
                      value={factor}
                      onChange={(event) => setFactor(Number(event.target.value))}
                    />
                    <output className="range-value" htmlFor="onb-factor">
                      {factor}%
                    </output>
                  </div>
                  <p className="field__hint">给突发情况留出余量，推荐 80%。</p>
                </div>
              </div>
              <div className="capacity-callout">
                <Target className="icon" aria-hidden="true" />
                <p>
                  有效日容量 = {dailyMinutes} 分钟 × {factor}% = <b>{effective} 分钟</b>。每日计划最多排入
                  3–6 项。
                </p>
              </div>
              <div className="onboarding-step__note">
                <Info className="icon" aria-hidden="true" />
                <span>之后可在「设置 → 档案与容量」随时调整。调整只影响未来的每日计划，不改写历史记录。</span>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="onboarding-step">
              <span className="onboarding-step__eyebrow">Step 02 · 目标</span>
              <h1>给这段准备一个明确的目标岗位。</h1>
              <p>目标只用于给路线定方向和判断风险，不会替你投递，也不做账号数据交换。</p>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="onb-job">目标岗位</label>
                  <input id="onb-job" defaultValue="Java 后端实习" />
                </div>
                <div className="field">
                  <label htmlFor="onb-city">目标城市</label>
                  <input id="onb-city" defaultValue="杭州 / 上海" />
                </div>
                <div className="field">
                  <label htmlFor="onb-industry">行业</label>
                  <select id="onb-industry" defaultValue="互联网 / 软件">
                    <option>互联网 / 软件</option>
                    <option>金融科技</option>
                    <option>企业服务</option>
                    <option>智能制造</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="onb-company">公司类型</label>
                  <select id="onb-company" defaultValue="不限">
                    <option>不限</option>
                    <option>大厂</option>
                    <option>中型技术公司</option>
                    <option>初创公司</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="onb-target-date">目标日期</label>
                  <input id="onb-target-date" type="date" defaultValue="2026-11-10" />
                </div>
                <div className="field">
                  <label htmlFor="onb-priority">优先级</label>
                  <select id="onb-priority" defaultValue="P0">
                    <option value="P0">P0 · 最高</option>
                    <option value="P1">P1 · 高</option>
                    <option value="P2">P2 · 普通</option>
                  </select>
                </div>
              </div>
              <label className="check-row" style={{ marginTop: 16 }}>
                <input type="checkbox" defaultChecked />
                <span>设为主目标（同一时间只启用一个主目标；其他目标可归档）</span>
              </label>
              <div className="onboarding-step__note">
                <Info className="icon" aria-hidden="true" />
                <span>Phase 1 不生成 AI 路线。你可以导入已有计划，或先创建一条空路线手动添加任务。</span>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="onboarding-step">
              <span className="onboarding-step__eyebrow">Step 03 · 计划</span>
              <h1>有现成计划？导入一份 Markdown。</h1>
              <p>恒序会把它拆成阶段、周和任务，并在确认前给你一份可编辑的预览。</p>

              <div className="upload-mini">
                <span className="upload-mini__icon">
                  <FileText className="icon" aria-hidden="true" />
                </span>
                <div className="upload-mini__copy">
                  <strong>{fileName}</strong>
                  <span>.md / .markdown · 单文件 ≤ 5MB · UTF-8</span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setFileName("后端冲刺计划.md · 已载入示例");
                    showToast("<strong>示例计划已就绪。</strong> 下一步会展示解析授权和推送设置。");
                  }}
                >
                  使用示例
                </Button>
              </div>

              <label className="check-row" style={{ marginTop: 14 }}>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                <span>
                  我同意将计划文本发送给第三方 AI 进行结构化解析（scope{" "}
                  <code style={{ fontFamily: "var(--mono)", fontSize: 9 }}>ai_import</code>，version
                  v1）。可在设置中随时撤销。
                </span>
              </label>

              <div className="onboarding-step__note">
                <TriangleAlert className="icon" aria-hidden="true" />
                <span>如果你还没有计划，也可以先跳过。今日页会引导你手动创建第一个任务。</span>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="onboarding-step">
              <span className="onboarding-step__eyebrow">Step 04 · 推送</span>
              <h1>让今天从一条企业微信消息开始。</h1>
              <p>企业微信群机器人是单向 Webhook。消息里的操作会链接回网页，不会在群里执行。</p>

              <div className="field" style={{ marginTop: 18 }}>
                <label htmlFor="onb-webhook">
                  群机器人 Webhook <small>可稍后配置</small>
                </label>
                <input
                  id="onb-webhook"
                  type="password"
                  placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
                  autoComplete="off"
                />
                <p className="field__hint">
                  仅接受 HTTPS、固定企业微信域名；密钥加密存储，页面只显示掩码。
                </p>
              </div>

              <div style={{ marginTop: 15 }}>
                <div className="toggle-row">
                  <div>
                    <strong>早报 · 07:30</strong>
                    <p>今日计划和重点任务，附 today_link。</p>
                  </div>
                  <Toggle checked={morning} onChange={setMorning} label="开启早报" />
                </div>
                <div className="toggle-row">
                  <div>
                    <strong>晚报 · 20:30</strong>
                    <p>今日完成率、未完成任务和顺延提示。</p>
                  </div>
                  <Toggle checked={evening} onChange={setEvening} label="开启晚报" />
                </div>
                <div className="toggle-row">
                  <div>
                    <strong>逾期与顺延</strong>
                    <p>20:00 提醒逾期；日界线后提示顺延与新的预计完成日期。</p>
                  </div>
                  <Toggle checked={reminders} onChange={setReminders} label="开启逾期与顺延" />
                </div>
              </div>

              <div className="onboarding-step__note">
                <Info className="icon" aria-hidden="true" />
                <span>未配置推送不影响使用。今日页和执行看板始终可用。</span>
              </div>
            </div>
          ) : null}

          <footer className="onboarding-actions">
            {step > 1 ? (
              <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="icon" aria-hidden="true" />
                上一步
              </Button>
            ) : (
              <span />
            )}
            <div className="onboarding-actions__right">
              <Link className="btn btn--ghost btn--sm" href="/today">
                跳过
              </Link>
              <Button variant="primary" size="sm" onClick={next}>
                {step === 4 ? "进入工作台" : "下一步"}
                <ArrowRight className="icon" aria-hidden="true" />
              </Button>
            </div>
          </footer>
        </section>

        <aside className="onboarding-aside">
          <section className="card aside-card">
            <h3>为什么先问时间？</h3>
            <p>
              大多数计划失败不是因为不努力，而是第一天就排了 6 小时。恒序用容量约束把“想做”变成“今天做得到”。
            </p>
            <div className="aside-formula">
              有效容量 = 每日可用 × 容量系数
              <br />
              {dailyMinutes} × {factor}% = {effective} 分钟/天
            </div>
          </section>
          <section className="card aside-card">
            <h3>完成后你会得到</h3>
            <ul className="aside-list">
              <li>
                <Check className="icon" aria-hidden="true" />
                <span>一份可执行的路线，带阶段、周和任务</span>
              </li>
              <li>
                <Check className="icon" aria-hidden="true" />
                <span>每天自动生成的 3–6 项今日任务</span>
              </li>
              <li>
                <Check className="icon" aria-hidden="true" />
                <span>执行看板：完成率、顺延率、预计完成日</span>
              </li>
              <li>
                <Check className="icon" aria-hidden="true" />
                <span>企微早报/晚报，不用打开系统也知道做什么</span>
              </li>
            </ul>
          </section>
          <section
            className="card aside-card"
            style={{ background: "linear-gradient(135deg,#fbfbff,#f6f6ff)" }}
          >
            <h3>随时可以改</h3>
            <p>时区、日界线、每日时间、容量系数和推送都能在设置里调整。调整不会改写已产生的执行记录。</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
