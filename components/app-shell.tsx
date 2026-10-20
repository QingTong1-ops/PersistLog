"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  Code2,
  Flag,
  LayoutGrid,
  Map,
  Route as RouteIcon,
  Settings,
  Target,
  Upload,
  User,
  X,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { IconButton, useToast } from "@/components/ui";
import { useAppStore } from "@/lib/store/app-store";
import { formatChineseDate, formatShortDate } from "@/lib/api/mappers";
import { cn } from "@/lib/utils";

const NAV_LABELS: Record<string, string> = {
  today: "今日",
  dashboard: "执行看板",
  routes: "学习路线",
  import: "导入计划",
  settings: "设置",
  login: "登录",
  onboarding: "首次引导",
};

function navKeyFromPath(pathname: string) {
  const segment = pathname.split("/").filter(Boolean)[0] ?? "today";
  if (segment === "settings") return "settings";
  if (segment === "routes") return pathname.split("/").filter(Boolean).length > 1 ? "routes" : "routes";
  return segment;
}

function Sidebar() {
  const pathname = usePathname();
  const active = navKeyFromPath(pathname);
  const { stats, routePercent, routeDone, routeTotal, profile } = useAppStore();
  const { showToast } = useToast();

  return (
    <aside className="sidebar">
      <Link className="brand" href="/today" aria-label="恒序 persistLog 首页">
        <BrandMark />
        <span>
          <span className="brand-name">恒序</span>
          <span className="brand-sub">persistLog</span>
        </span>
      </Link>

      <nav className="side-nav" aria-label="主导航">
        <div className="nav-group">
          <p className="nav-label">工作台</p>
          <Link className={cn("nav-item", active === "today" && "is-active")} href="/today">
            <LayoutGrid className="icon" aria-hidden="true" />
            <span>今日</span>
            <span className="nav-badge">{stats.considered.length}</span>
          </Link>
          <Link
            className={cn("nav-item", active === "dashboard" && "is-active")}
            href="/dashboard"
          >
            <BarChart3 className="icon" aria-hidden="true" />
            <span>执行看板</span>
          </Link>
        </div>

        <div className="nav-group">
          <p className="nav-label">计划</p>
          <Link className={cn("nav-item", active === "routes" && "is-active")} href="/routes">
            <RouteIcon className="icon" aria-hidden="true" />
            <span>学习路线</span>
          </Link>
          <Link className={cn("nav-item", active === "import" && "is-active")} href="/import">
            <Upload className="icon" aria-hidden="true" />
            <span>导入计划</span>
          </Link>
        </div>

        <div className="nav-group">
          <p className="nav-label">后续阶段</p>
          <button
            className="nav-item is-locked"
            type="button"
            onClick={() => showToast("<strong>代码练习将在 Phase 2 开放。</strong> 当前先把计划执行跑起来。")}
          >
            <Code2 className="icon" aria-hidden="true" />
            <span>代码练习</span>
            <span className="nav-tag">P2</span>
          </button>
          <button
            className="nav-item is-locked"
            type="button"
            onClick={() => showToast("<strong>错题复习将在 Phase 3 开放。</strong> Phase 1 先做执行闭环。")}
          >
            <BookOpen className="icon" aria-hidden="true" />
            <span>错题复习</span>
            <span className="nav-tag">P3</span>
          </button>
        </div>
      </nav>

      <div className="sidebar-goal">
        <p className="sidebar-goal__label">当前主目标</p>
        <p className="sidebar-goal__title">
          {profile.goal}
          {profile.targetDate ? ` · ${formatShortDate(profile.targetDate)}` : ""}
        </p>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${routePercent}%` }} />
        </div>
        <div className="sidebar-goal__meta">
          <span>路线进度</span>
          <b className="tnum">
            {routePercent}% · {routeDone}/{routeTotal}
          </b>
        </div>
      </div>

      <div className="sidebar-profile">
        <span className="avatar">{profile.initial}</span>
        <div className="sidebar-profile__copy">
          <b>{profile.name}</b>
          <span>
            每天 {profile.dailyMinutes} 分钟 · 有效{" "}
            {Math.max(30, Math.round(profile.dailyMinutes * profile.capacityFactor))} 分钟
          </span>
        </div>
        <Link className="icon-button sidebar-settings" href="/settings/profile" aria-label="个人设置">
          <Settings className="icon" aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}

function DevNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { completeAll, clearToday, resetDemo, live } = useAppStore();

  if (!open) return null;

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div
      className="dev-nav-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="dev-nav" role="dialog" aria-modal="true" aria-label="页面地图">
        <div className="dev-nav__head">
          <div>
            <h2>页面地图</h2>
            <p>Phase 1 开发预览 · 状态演示与路由入口</p>
          </div>
          <IconButton type="button" aria-label="关闭页面地图" onClick={onClose}>
            <X className="icon" aria-hidden="true" />
          </IconButton>
        </div>

        <div className="dev-nav__section">
          <h3>入口</h3>
          <div className="dev-nav__grid">
            <button className="dev-nav__link" type="button" onClick={() => go("/login")}>
              <User className="icon" aria-hidden="true" /> 登录 / 注册
            </button>
            <button className="dev-nav__link" type="button" onClick={() => go("/onboarding")}>
              <Flag className="icon" aria-hidden="true" /> 首次引导
            </button>
          </div>
        </div>

        <div className="dev-nav__section">
          <h3>核心流程</h3>
          <div className="dev-nav__grid">
            <button className="dev-nav__link" type="button" onClick={() => go("/today")}>
              <LayoutGrid className="icon" aria-hidden="true" /> 今日执行
            </button>
            <button className="dev-nav__link" type="button" onClick={() => go("/dashboard")}>
              <BarChart3 className="icon" aria-hidden="true" /> 执行看板
            </button>
            <button className="dev-nav__link" type="button" onClick={() => go("/routes")}>
              <RouteIcon className="icon" aria-hidden="true" /> 学习路线
            </button>
            <button className="dev-nav__link" type="button" onClick={() => go("/routes/1")}>
              <RouteIcon className="icon" aria-hidden="true" /> 路线详情 / 版本
            </button>
            <button className="dev-nav__link" type="button" onClick={() => go("/import")}>
              <Upload className="icon" aria-hidden="true" /> 导入上传
            </button>
            <button className="dev-nav__link" type="button" onClick={() => go("/import?state=preview")}>
              <Upload className="icon" aria-hidden="true" /> 导入预览与问题
            </button>
          </div>
        </div>

        <div className="dev-nav__section">
          <h3>设置</h3>
          <div className="dev-nav__grid">
            <button className="dev-nav__link" type="button" onClick={() => go("/settings/profile")}>
              <User className="icon" aria-hidden="true" /> 档案与容量
            </button>
            <button className="dev-nav__link" type="button" onClick={() => go("/settings/notifications")}>
              <Bell className="icon" aria-hidden="true" /> 企业微信推送
            </button>
            <button className="dev-nav__link" type="button" onClick={() => go("/settings/ai")}>
              <Target className="icon" aria-hidden="true" /> AI 授权
            </button>
            <button className="dev-nav__link" type="button" onClick={() => go("/settings/data")}>
              <Settings className="icon" aria-hidden="true" /> 数据与账号
            </button>
          </div>
        </div>

        <div className="dev-nav__section">
          <h3>状态演示</h3>
          <div className="dev-nav__grid">
            {live ? (
              <p className="muted" style={{ fontSize: 11, lineHeight: 1.7 }}>
                当前是真实后端数据，演示动作已禁用；`?state=` 只在未登录的 mock 模式生效。
              </p>
            ) : (
              <>
                <button
              className="dev-nav__link"
              type="button"
              onClick={() => {
                completeAll();
                go("/today");
              }}
            >
              <LayoutGrid className="icon" aria-hidden="true" /> 今日全部完成
            </button>
            <button
              className="dev-nav__link"
              type="button"
              onClick={() => {
                clearToday();
                go("/today");
              }}
            >
              <LayoutGrid className="icon" aria-hidden="true" /> 今日无任务
            </button>
            <button className="dev-nav__link" type="button" onClick={() => go("/import?state=error")}>
              <Flag className="icon" aria-hidden="true" /> 导入解析失败
            </button>
            <button className="dev-nav__link" type="button" onClick={() => go("/routes?state=empty")}>
              <RouteIcon className="icon" aria-hidden="true" /> 路线空状态
            </button>
            <button className="dev-nav__link" type="button" onClick={() => go("/dashboard?state=empty")}>
              <BarChart3 className="icon" aria-hidden="true" /> 看板空状态
            </button>
            <button
              className="dev-nav__link"
              type="button"
              onClick={() => {
                resetDemo();
                go("/today");
              }}
            >
              <Target className="icon" aria-hidden="true" /> 重置演示数据
            </button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Topbar() {
  const pathname = usePathname();
  const [devNavOpen, setDevNavOpen] = useState(false);
  const { showToast } = useToast();
  const { profile, todayDate } = useAppStore();
  const segments = pathname.split("/").filter(Boolean);
  const root = segments[0] ?? "today";
  const pageLabel = root === "routes" && segments[1] ? "路线详情" : NAV_LABELS[root] ?? "今日";
  const showDevNav =
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_SHOW_DEV_NAV === "true";

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <Link className="mobile-brand" href="/today" aria-label="恒序首页">
            <BrandMark size={30} />
            恒序
          </Link>
          <div className="breadcrumb" aria-label="面包屑">
            <span>工作台</span>
            <span>/</span>
            <strong>{pageLabel}</strong>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="proto-badge">Phase 1 · 执行层</span>
          <span className="date-chip">
            <Calendar className="icon" aria-hidden="true" />
            {formatChineseDate(todayDate)}
          </span>
          {showDevNav ? (
            <IconButton type="button" aria-label="打开页面地图" onClick={() => setDevNavOpen(true)}>
              <Map className="icon" aria-hidden="true" />
            </IconButton>
          ) : null}
          <IconButton
            type="button"
            aria-label="通知"
            onClick={() =>
              showToast("<strong>今晚 20:30 会推送晚报；逾期任务会在 20:00 提醒。</strong>")
            }
          >
            <span className="icon-button__dot" />
            <Bell className="icon" aria-hidden="true" />
          </IconButton>
          <Link className="topbar-avatar" href="/settings/profile">
            <span>{profile.name}</span>
            <span className="avatar avatar--sm">{profile.initial}</span>
          </Link>
        </div>
      </header>
      <DevNav open={devNavOpen} onClose={() => setDevNavOpen(false)} />
    </>
  );
}

function MobileNav() {
  const pathname = usePathname();
  const active = navKeyFromPath(pathname);
  const items = [
    { href: "/today", key: "today", label: "今日", icon: LayoutGrid },
    { href: "/dashboard", key: "dashboard", label: "看板", icon: BarChart3 },
    { href: "/routes", key: "routes", label: "路线", icon: RouteIcon },
    { href: "/settings/profile", key: "settings", label: "我的", icon: User },
  ];

  return (
    <nav className="mobile-nav" aria-label="移动端导航">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} className={active === item.key ? "is-active" : undefined}>
            <Icon className="icon" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <Topbar />
        <main className="main">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}

