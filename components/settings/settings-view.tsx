"use client";

/* eslint-disable react-hooks/set-state-in-effect -- settings forms hydrate from the authenticated profile and notification API. */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  Bell,
  Check,
  Info,
  LogOut,
  RefreshCw,
  Server,
  Shield,
  Sparkles,
  User,
} from "lucide-react";
import {
  Button,
  ConfirmDialog,
  Modal,
  PageHeader,
  Tag,
  Toggle,
  useToast,
} from "@/components/ui";
import { useAppStore } from "@/lib/store/app-store";
import { useAuth } from "@/lib/auth/auth-provider";
import { live } from "@/lib/api/live";
import { cn } from "@/lib/utils";

type SettingsTab = "profile" | "notifications" | "ai" | "data";

const TABS: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
  { id: "profile", label: "档案与容量", icon: <User className="icon" aria-hidden="true" /> },
  { id: "notifications", label: "企业微信推送", icon: <Bell className="icon" aria-hidden="true" /> },
  { id: "ai", label: "AI 授权", icon: <Sparkles className="icon" aria-hidden="true" /> },
  { id: "data", label: "数据与账号", icon: <Shield className="icon" aria-hidden="true" /> },
];

export function SettingsView({ tab }: { tab: string }) {
  const active = (TABS.find((item) => item.id === tab)?.id ?? "profile") as SettingsTab;
  const { profile } = useAppStore();

  return (
    <div className="view">
      <PageHeader
        eyebrow="Settings"
        title="设置"
        description="调整档案、每日容量、企业微信推送和 AI 授权。变更只影响未来计划，不改写历史记录。"
        side={
          <span className="goal-pill">
            <i />
            当前主目标：{profile.goal}
          </span>
        }
      />

      <div className="settings-layout">
        <nav className="card settings-nav" aria-label="设置导航">
          {TABS.map((item) => (
            <Link
              key={item.id}
              href={`/settings/${item.id}`}
              className={active === item.id ? "is-active" : undefined}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        <div>
          {active === "profile" ? <ProfilePanel /> : null}
          {active === "notifications" ? <NotificationsPanel /> : null}
          {active === "ai" ? <AIPanel /> : null}
          {active === "data" ? <DataPanel /> : null}
        </div>
      </div>
    </div>
  );
}

function PanelHead({
  title,
  description,
  onSave,
}: {
  title: string;
  description: string;
  onSave?: () => void;
}) {
  return (
    <div className="settings-panel__head">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {onSave ? (
        <Button variant="primary" size="sm" onClick={onSave}>
          保存更改
        </Button>
      ) : null}
    </div>
  );
}

function ProfilePanel() {
  const { showToast } = useToast();
  const { profile, jobTargets, refreshLive } = useAppStore();
  const primaryTarget =
    jobTargets.find((target) => target.is_primary && target.status === "active") ?? jobTargets[0];
  const [dailyMinutes, setDailyMinutes] = useState(profile.dailyMinutes);
  const [factor, setFactor] = useState(Math.round(profile.capacityFactor * 100));
  const [goal, setGoal] = useState(profile.goal);
  const [city, setCity] = useState(primaryTarget?.city ?? "杭州 / 上海");
  const [industry, setIndustry] = useState(primaryTarget?.industry ?? "互联网 / 软件");
  const [targetDate, setTargetDate] = useState(profile.targetDate);
  const [priority, setPriority] = useState(primaryTarget?.priority ?? "P0");
  const [autoCarry, setAutoCarry] = useState(true);
  const [emptyPlan, setEmptyPlan] = useState(true);
  const [askActual, setAskActual] = useState(true);
  const [saving, setSaving] = useState(false);
  const effective = Math.round((dailyMinutes * factor) / 100);

  useEffect(() => {
    setDailyMinutes(profile.dailyMinutes);
    setFactor(Math.round(profile.capacityFactor * 100));
    setGoal(profile.goal);
    setTargetDate(profile.targetDate);
  }, [profile.capacityFactor, profile.dailyMinutes, profile.goal, profile.targetDate]);

  useEffect(() => {
    if (!primaryTarget) return;
    setGoal(primaryTarget.title);
    setCity(primaryTarget.city ?? "");
    setIndustry(primaryTarget.industry ?? "互联网 / 软件");
    setTargetDate(primaryTarget.target_date ?? "");
    setPriority(primaryTarget.priority);
  }, [primaryTarget]);

  async function saveProfile() {
    if (saving) return;
    setSaving(true);
    try {
      await live.profile.update({
        display_name: profile.name,
        timezone: profile.timezone,
        daily_available_minutes: dailyMinutes,
        planning_capacity_factor: factor / 100,
        day_boundary_hour: 4,
      });
      if (primaryTarget) {
        await live.profile.updateJob(primaryTarget.id, {
          title: goal,
          city,
          industry,
          target_date: targetDate || undefined,
          priority,
        });
      } else {
        await live.profile.createJob({
          title: goal,
          city,
          industry,
          target_date: targetDate || undefined,
          priority,
          is_primary: true,
        });
      }
      await refreshLive();
      showToast("<strong>档案设置已保存。</strong> 变更只影响未来计划，历史记录保持不变。");
    } catch (cause) {
      showToast(
        `<strong>设置没有保存。</strong> ${cause instanceof Error ? cause.message : "后端请求失败"}`,
        "risk"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card settings-panel">
      <PanelHead
        title="档案与容量"
        description="决定每日计划的时间预算和“今天”的边界。"
        onSave={() => void saveProfile()}
      />

      <div className="settings-section">
        <div className="settings-section__title">
          <h3>时间与容量</h3>
          <span>影响每日计划生成</span>
        </div>
        <div className="form-grid form-grid--3">
          <div className="field">
            <label htmlFor="set-timezone">时区</label>
            <select id="set-timezone" defaultValue="Asia/Shanghai">
              <option value="Asia/Shanghai">Asia/Shanghai</option>
              <option value="Asia/Tokyo">Asia/Tokyo</option>
              <option value="Europe/London">Europe/London</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="set-boundary">日界线</label>
            <select id="set-boundary" defaultValue="04:00">
              <option value="04:00">04:00 · 推荐</option>
              <option value="00:00">00:00</option>
              <option value="06:00">06:00</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="set-minutes">每日可用分钟</label>
            <input
              id="set-minutes"
              type="number"
              value={dailyMinutes}
              onChange={(event) => setDailyMinutes(Number(event.target.value))}
            />
          </div>
        </div>
        <div className="field" style={{ marginTop: 15 }}>
          <label htmlFor="set-factor">
            容量系数 <small>0.6–1.0</small>
          </label>
          <div className="range-row">
            <input
              id="set-factor"
              type="range"
              min={60}
              max={100}
              step={5}
              value={factor}
              onChange={(event) => setFactor(Number(event.target.value))}
            />
            <output className="range-value" htmlFor="set-factor">
              {factor}%
            </output>
          </div>
        </div>
        <div className="capacity-callout">
          <Check className="icon" aria-hidden="true" />
          <p>
            有效日容量 = {dailyMinutes} 分钟 × {factor}% = <b>{effective} 分钟</b>。这是每日计划的上限，不是必须排满的目标。
          </p>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section__title">
          <h3>求职目标</h3>
          <span className="status status--active">当前主目标</span>
        </div>
        <div className="form-grid form-grid--3">
          <div className="field">
            <label htmlFor="set-job">目标岗位</label>
            <input id="set-job" value={goal} onChange={(event) => setGoal(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="set-city">目标城市</label>
            <input id="set-city" value={city} onChange={(event) => setCity(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="set-target-date">目标日期</label>
            <input
              id="set-target-date"
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
            />
          </div>
        </div>
        <div className="form-grid" style={{ marginTop: 15 }}>
          <div className="field">
            <label htmlFor="set-industry">行业</label>
            <select
              id="set-industry"
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
            >
              <option>互联网 / 软件</option>
              <option>金融科技</option>
              <option>企业服务</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="set-priority">优先级</label>
            <select
              id="set-priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as "P0" | "P1" | "P2")}
            >
              <option value="P0">P0 · 最高</option>
              <option value="P1">P1 · 高</option>
              <option value="P2">P2 · 普通</option>
            </select>
          </div>
        </div>
        <p className="field__hint" style={{ marginTop: 10 }}>
          同一时间只启用一个主目标。其他目标可归档；目标变化后可调整路线，但不会自动覆盖执行中的路线。
        </p>
      </div>

      <div className="settings-section">
        <div className="settings-section__title">
          <h3>计划与记录偏好</h3>
        </div>
        <div className="toggle-row">
          <div>
            <strong>自动顺延未完成任务</strong>
            <p>日界线后把 pending / in_progress / blocked 实例放入下一天，并更新预测日期。</p>
          </div>
          <Toggle checked={autoCarry} onChange={setAutoCarry} label="自动顺延" />
        </div>
        <div className="toggle-row">
          <div>
            <strong>没有任务也创建空计划</strong>
            <p>便于推送、看板和活跃天数记录；空计划不会计入未完成。</p>
          </div>
          <Toggle checked={emptyPlan} onChange={setEmptyPlan} label="创建空计划" />
        </div>
        <div className="toggle-row">
          <div>
            <strong>完成任务时询问实际分钟</strong>
            <p>实际分钟用于时间偏差和预测；不填写时按计划分钟估算并标注。</p>
          </div>
          <Toggle checked={askActual} onChange={setAskActual} label="询问实际分钟" />
        </div>
      </div>
    </section>
  );
}

interface NotificationEvent {
  id: string;
  name: string;
  description: string;
  time: string;
  enabled: boolean;
}

const INITIAL_EVENTS: NotificationEvent[] = [
  { id: "morning", name: "早报", description: "今日计划已生成 · 必须带 today_link", time: "07:30", enabled: true },
  { id: "evening", name: "晚报", description: "今日有未完成任务 · 汇总完成与顺延", time: "20:30", enabled: true },
  { id: "overdue", name: "逾期", description: "有逾期任务 · 可被免打扰丢弃", time: "20:00", enabled: true },
  { id: "carry", name: "顺延", description: "日界线后发生顺延 · 附新的预测日期", time: "04:10", enabled: true },
  { id: "weekly", name: "周总结", description: "周日 20:00 · 本周有任务才发送", time: "20:00", enabled: true },
];

function NotificationsPanel() {
  const { showToast } = useToast();
  const { live: isLive } = useAppStore();
  const [connected, setConnected] = useState(false);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [webhookMask, setWebhookMask] = useState("未配置");
  const [lastTest, setLastTest] = useState("尚未测试");
  const [events, setEvents] = useState(INITIAL_EVENTS);
  const [dnd, setDnd] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [outbox, setOutbox] = useState<Array<{ id: string; event_type: string; status: string; attempts: number; last_error: string | null; created_at: string }>>([]);

  async function loadNotifications() {
    if (!isLive) return;
    try {
      const [channels, preferences, outboxItems] = await Promise.all([
        live.notifications.channels(),
        live.notifications.preferences(),
        live.notifications.outbox(),
      ]);
      const channel = channels.find((item) => item.status === "active") ?? channels[0];
      setConnected(Boolean(channel));
      setChannelId(channel?.id ?? null);
      setWebhookMask(channel?.webhook_masked ?? "未配置");
      setLastTest(channel?.last_test_at ? "最近测试：" + channel.last_test_at.slice(0, 19).replace("T", " ") : "尚未测试");
      setOutbox(outboxItems);
      setEvents((current) =>
        current.map((event) => {
          const key = event.id === "carry" ? "carry_over" : event.id;
          const preference = preferences.find((item) => item.event_type === key);
          return preference
            ? {
                ...event,
                enabled: preference.enabled,
                time: preference.send_time?.slice(0, 5) ?? event.time,
              }
            : event;
        })
      );
    } catch (cause) {
      showToast(
        `<strong>通知配置加载失败。</strong> ${cause instanceof Error ? cause.message : "后端请求失败"}`,
        "risk"
      );
    }
  }

  useEffect(() => {
    void loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive]);

  async function savePreferences() {
    if (!channelId) {
      showToast("<strong>还没有通知渠道。</strong> 请先配置企业微信 Webhook。", "risk");
      return;
    }
    try {
      await live.notifications.updatePreferences(
        events.map((event) => ({
          event_type: event.id === "carry" ? "carry_over" : event.id,
          channel_id: channelId,
          enabled: event.enabled,
          send_time: event.time,
          timezone: "Asia/Shanghai",
          quiet_hours_behavior: dnd ? "delay" : "drop",
        }))
      );
      await loadNotifications();
      showToast("<strong>通知设置已保存。</strong> 变更只影响未来计划，历史记录保持不变。");
    } catch (cause) {
      showToast(
        `<strong>通知设置没有保存。</strong> ${cause instanceof Error ? cause.message : "后端请求失败"}`,
        "risk"
      );
    }
  }

  function updateEvent(id: string, patch: Partial<NotificationEvent>) {
    setEvents((current) => current.map((event) => (event.id === id ? { ...event, ...patch } : event)));
  }

  return (
    <section className="card settings-panel">
      <PanelHead
        title="企业微信推送"
        description="单向群机器人 Webhook。未配置不影响今日页和看板。"
        onSave={() => void savePreferences()}
      />

      <div className="settings-section">
        <div className="settings-section__title">
          <h3>推送渠道</h3>
          <span className={cn("status", connected ? "status--active" : "status--neutral")}>
            {connected ? "已连接" : "未连接"}
          </span>
        </div>
        <div className="channel-card">
          <span className="channel-icon">
            <Bell className="icon" aria-hidden="true" />
          </span>
          <div className="channel-copy">
            <div className="channel-copy__title">
              <strong>企业微信群机器人</strong>
              <Tag variant={connected ? "teal" : "neutral"}>{connected ? "生产配置" : "未配置"}</Tag>
            </div>
            <p>
              Webhook：<code>{webhookMask}</code>
            </p>
            <p>最近测试发送：{lastTest}</p>
            <div className="channel-actions">
              <Button
                variant="secondary"
                size="xs"
                disabled={!connected}
                onClick={async () => {
                  if (!channelId) return;
                  try {
                    await live.notifications.test(channelId);
                    setLastTest("刚刚 · 已发送");
                    await loadNotifications();
                    showToast("<strong>测试消息已发送。</strong> 失败会按 1/5/30 分钟重试并进入 Outbox。");
                  } catch (cause) {
                    showToast(
                      `<strong>测试发送失败。</strong> ${cause instanceof Error ? cause.message : "后端请求失败"}`,
                      "risk"
                    );
                  }
                }}
              >
                发送测试消息
              </Button>
              <Button variant="ghost" size="xs" onClick={() => setEditOpen(true)}>
                更换 Webhook
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => (connected ? setDisconnectOpen(true) : setEditOpen(true))}
              >
                {connected ? "断开" : "连接"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section__title">
          <h3>通知事件</h3>
          <span>时间按用户时区</span>
        </div>
        <div className="event-table">
          <div className="event-row event-row--head">
            <span>事件</span>
            <span>发送时间</span>
            <span>开启</span>
          </div>
          {events.map((event) => (
            <div className="event-row" key={event.id}>
              <div className="event-name">
                <strong>{event.name}</strong>
                <span>{event.description}</span>
              </div>
              <input
                type="time"
                value={event.time}
                aria-label={`${event.name}时间`}
                onChange={(input) => updateEvent(event.id, { time: input.target.value })}
              />
              <Toggle
                checked={event.enabled}
                onChange={(checked) => updateEvent(event.id, { enabled: checked })}
                label={`开启${event.name}`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section__title">
          <h3>免打扰</h3>
          <span>静默时段内按策略延迟或丢弃</span>
        </div>
        <div className="dnd-grid">
          <div className="field">
            <label htmlFor="dnd-start">开始</label>
            <input id="dnd-start" type="time" defaultValue="23:00" />
          </div>
          <div className="field">
            <label htmlFor="dnd-end">结束</label>
            <input id="dnd-end" type="time" defaultValue="07:00" />
          </div>
        </div>
        <div className="toggle-row">
          <div>
            <strong>开启免打扰</strong>
            <p>早报 / 晚报 / 周总结延迟到静默结束；逾期 / 顺延可直接丢弃。</p>
          </div>
          <Toggle checked={dnd} onChange={setDnd} label="开启免打扰" />
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section__title">
          <h3>最近发送</h3>
          <Link className="card__link" href="/settings/notifications">
            查看全部
          </Link>
        </div>
        <div className="outbox">
          {isLive ? (
            outbox.length ? (
              outbox.map((item) => (
                <div className="outbox-row" key={item.id}>
                  <div>
                    <strong>{item.event_type}</strong>
                    <span>
                      {item.created_at.slice(0, 16).replace("T", " ")} · {item.attempts} 次尝试
                    </span>
                  </div>
                  <span
                    className={cn(
                      "status",
                      item.status === "sent"
                        ? "status--active"
                        : item.status === "dead"
                          ? "status--risk"
                          : "status--paused"
                    )}
                  >
                    {item.status}
                  </span>
                  {item.status === "failed" || item.status === "dead" ? (
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={async () => {
                        try {
                          await live.notifications.resend(item.id);
                          await loadNotifications();
                          showToast("<strong>已重新入队。</strong> 稍后查看发送结果。");
                        } catch (cause) {
                          showToast(
                            `<strong>重发失败。</strong> ${cause instanceof Error ? cause.message : "后端请求失败"}`,
                            "risk"
                          );
                        }
                      }}
                    >
                      重发
                    </Button>
                  ) : (
                    <span />
                  )}
                </div>
              ))
            ) : (
              <p className="muted" style={{ fontSize: 11 }}>
                暂无发送记录。配置渠道并触发一次通知后会出现在这里。
              </p>
            )
          ) : (
            <>
              <div className="outbox-row">
                <div>
                  <strong>早报 · 10/19 周一</strong>
                  <span>07:30 · 送达 1 个群</span>
                </div>
                <span className="status status--active">已发送</span>
                <span />
              </div>
              <div className="outbox-row">
                <div>
                  <strong>逾期提醒 · 2 项</strong>
                  <span>昨天 20:00 · 第 1 次重试</span>
                </div>
                <span className="status status--paused">重试中</span>
                <Button variant="ghost" size="xs" onClick={() => showToast("<strong>已手动重发。</strong> 1 分钟后再次尝试。")}>
                  重发
                </Button>
              </div>
              <div className="outbox-row">
                <div>
                  <strong>周总结 · 第 17 周</strong>
                  <span>10/12 20:00 · 3 次重试后 dead</span>
                </div>
                <span className="status status--risk">dead</span>
                <Button variant="secondary" size="xs" onClick={() => showToast("<strong>已重新入队。</strong> 稍后查看发送结果。")}>
                  重新入队
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="更换企业微信 Webhook"
        subtitle="只接受 HTTPS 与企业微信固定域名；密钥会加密存储"
      >
        <form
          className="modal__form"
          onSubmit={async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const webhook = new FormData(event.currentTarget).get("webhook")?.toString() ?? "";
            if (!webhook) return;
            try {
              if (channelId) {
                await live.notifications.updateChannel(channelId, {
                  name: "企业微信群机器人",
                  webhook_url: webhook,
                });
              } else {
                await live.notifications.createChannel({
                  name: "企业微信群机器人",
                  webhook_url: webhook,
                });
              }
              await loadNotifications();
              setEditOpen(false);
              showToast("<strong>Webhook 已保存。</strong> 可点击测试发送验证渠道。");
            } catch (cause) {
              showToast(
                `<strong>Webhook 保存失败。</strong> ${cause instanceof Error ? cause.message : "后端请求失败"}`,
                "risk"
              );
            }
          }}
        >
          <div className="field">
            <label htmlFor="webhook-input">Webhook 地址</label>
            <input
              id="webhook-input"
              name="webhook"
              type="password"
              placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
              required
            />
            <p className="field__hint">保存后页面只显示掩码。测试发送会进入 Outbox 队列。</p>
          </div>
          <div className="modal__foot">
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(false)}>
              取消
            </Button>
            <Button variant="primary" size="sm" type="submit">
              保存并测试
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={disconnectOpen}
        onClose={() => setDisconnectOpen(false)}
        title="断开企业微信渠道"
        subtitle="企业微信群机器人"
        body={<p>断开后不再发送早报、晚报、逾期和顺延提醒。今日页和看板仍然可用。</p>}
        confirmText="确认断开"
        onConfirm={async () => {
          setDisconnectOpen(false);
          if (isLive && channelId) {
            try {
              await live.notifications.deleteChannel(channelId);
              await loadNotifications();
              showToast("<strong>渠道已断开。</strong> 可在设置中重新配置 Webhook。", "risk");
            } catch (cause) {
              showToast(
                `<strong>断开失败。</strong> ${cause instanceof Error ? cause.message : "后端请求失败"}`,
                "risk"
              );
            }
            return;
          }
          setConnected(false);
          showToast("<strong>渠道已断开。</strong> 可在设置中重新配置 Webhook。", "risk");
        }}
      />
    </section>
  );
}

function AIPanel() {
  const { consentGranted, setConsentGranted } = useAppStore();
  const { showToast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <section className="card settings-panel">
      <PanelHead title="AI 授权" description="AI 只把计划结构化，不替用户生成路线；Phase 1 不接入真实模型。" />
      <div className="settings-section">
        <div className="settings-section__title">
          <h3>计划解析授权</h3>
          <span>scope ai_import · version v1</span>
        </div>
        <div className="consent-card">
          <div className="consent-card__head">
            <strong>
              <Shield className="icon" aria-hidden="true" />
              计划文本可用于 AI 结构化
            </strong>
            <Button variant="danger" size="xs" onClick={() => setConfirmOpen(true)}>
              {consentGranted ? "撤销授权" : "重新授权"}
            </Button>
          </div>
          <p>
            只有在你上传 Markdown 并确认后，计划文本才会发送给第三方 AI。不会发送账号密码、简历、面试记录或通知配置。
          </p>
          <div className="consent-meta">
            <span>授权状态：<b>{consentGranted ? "已授权" : "未授权"}</b></span>
            <span>授权版本：<b>v1</b></span>
            <span>最近使用：<b>2026-10-19 09:15</b></span>
          </div>
        </div>
        <div className="insight" style={{ marginTop: 12 }}>
          <Info className="icon" aria-hidden="true" />
          <span>撤销后不能导入新的 Markdown；已有路线、任务和今日页不受影响，也可以继续手动创建任务。</span>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section__title">
          <h3>当前 AI Provider</h3>
          <Tag variant="neutral">Stub</Tag>
        </div>
        <div className="channel-card" style={{ borderColor: "var(--line)", background: "#fbfcff" }}>
          <span className="channel-icon" style={{ color: "var(--ink-600)" }}>
            <Server className="icon" aria-hidden="true" />
          </span>
          <div className="channel-copy">
            <div className="channel-copy__title">
              <strong>本地 Stub Provider</strong>
              <Tag variant="neutral">未配置真实模型</Tag>
            </div>
            <p>当前用于开发与验收，不访问外网。正式接入前，非 stub Provider 会明确返回未配置错误，不会静默降级。</p>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section__title">
          <h3>数据处理边界</h3>
        </div>
        <ul className="aside-list">
          <li>
            <Check className="icon" aria-hidden="true" />
            <span>只发送当前上传的计划文本，不发送历史路线或执行记录。</span>
          </li>
          <li>
            <Check className="icon" aria-hidden="true" />
            <span>AI 输出必须经过规则校验和用户确认，才能创建路线。</span>
          </li>
          <li>
            <Check className="icon" aria-hidden="true" />
            <span>AI 不执行代码、不做沙箱判题、不生成能力分数。</span>
          </li>
        </ul>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={consentGranted ? "撤销 AI 解析授权" : "重新授权 AI 解析"}
        subtitle="scope ai_import · version v1"
        body={
          <p>
            {consentGranted
              ? "撤销后不能导入新的 Markdown，已有路线、任务和今日页不受影响。你可以继续手动创建任务。"
              : "重新授权后，上传 Markdown 时计划文本可以发送给第三方 AI 做结构化解析。"}
          </p>
        }
        confirmText={consentGranted ? "确认撤销" : "确认授权"}
        onConfirm={() => {
          setConsentGranted(!consentGranted);
          setConfirmOpen(false);
          showToast(
            consentGranted
              ? "<strong>授权已撤销。</strong> 你可以随时重新授权。"
              : "<strong>授权已恢复。</strong> 现在可以导入新的 Markdown。",
            consentGranted ? "risk" : "success"
          );
        }}
      />
    </section>
  );
}

function DataPanel() {
  const router = useRouter();
  const { showToast } = useToast();
  const { profile } = useAppStore();
  const { logout, refresh } = useAuth();

  return (
    <section className="card settings-panel">
      <PanelHead title="数据与账号" description="数据属于用户。导出、删除账号和审计能力按阶段开放。" />
      <div className="settings-section">
        <div className="settings-section__title">
          <h3>账号</h3>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>登录账号</label>
            <input value={profile.email} disabled />
          </div>
          <div className="field">
            <label>注册时间</label>
            <input value={profile.createdAt?.slice(0, 10) ?? "—"} disabled />
          </div>
        </div>
        <div className="channel-actions" style={{ marginTop: 12 }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
          >
            <LogOut className="icon" aria-hidden="true" />
            退出登录
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              const ok = await refresh();
              showToast(
                ok
                  ? "<strong>会话已刷新。</strong> Access Token 保存在内存，Refresh Token 在 HttpOnly Cookie。"
                  : "<strong>会话已失效。</strong> 请重新登录。",
                ok ? "success" : "risk"
              );
            }}
          >
            <RefreshCw className="icon" aria-hidden="true" />
            刷新会话
          </Button>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section__title">
          <h3>数据管理</h3>
          <span>Phase 1 后续开放</span>
        </div>
        <div className="danger-zone">
          <div className="danger-row">
            <div>
              <strong>
                导出全部数据 <Tag variant="neutral">后续</Tag>
              </strong>
              <p>导出路线、任务、每日计划、执行记录和通知配置为 JSON。</p>
            </div>
            <Button variant="secondary" size="xs" disabled>
              导出
            </Button>
          </div>
          <div className="danger-row">
            <div>
              <strong>
                删除账号 <Tag variant="neutral">后续</Tag>
              </strong>
              <p>删除前需要二次确认和邮件验证；当前版本不提供。</p>
            </div>
            <Button variant="danger" size="xs" disabled>
              删除
            </Button>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section__title">
          <h3>安全与审计</h3>
        </div>
        <div className="outbox">
          <div className="outbox-row">
            <div>
              <strong>审计日志</strong>
              <span>导入确认、路线调整、通知渠道变更</span>
            </div>
            <Tag variant="neutral">Phase 1 内部</Tag>
            <Button
              variant="ghost"
              size="xs"
              onClick={() =>
                showToast("<strong>审计日志接口已存在。</strong> Phase 1 不做管理后台，仅通过运维工具查看。")
              }
            >
              查看
            </Button>
          </div>
          <div className="outbox-row">
            <div>
              <strong>登录设备</strong>
              <span>当前设备 · Windows · Chrome</span>
            </div>
            <span className="status status--active">当前</span>
            <span />
          </div>
        </div>
      </div>
    </section>
  );
}
