"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button, useToast } from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "register";

const isDev = process.env.NODE_ENV === "development";
const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL ?? "";
const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "";

export function LoginView() {
  const router = useRouter();
  const { showToast } = useToast();
  const { status, login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [account, setAccount] = useState(demoEmail || (isDev ? "demo@persistlog.dev" : ""));
  const [password, setPassword] = useState(demoPassword || (isDev ? "Demo2026!" : ""));
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === "register";

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/today");
    }
  }, [router, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const email = account.trim();
    if (!email || !email.includes("@")) {
      showToast("<strong>请输入有效邮箱。</strong> 当前后端使用邮箱登录。", "risk");
      return;
    }
    if (password.length < 8) {
      showToast("<strong>密码至少 8 位。</strong> 后端要求 8–128 位。", "risk");
      return;
    }
    if (isRegister && password !== confirm) {
      showToast("<strong>两次密码不一致。</strong> 请重新确认。", "risk");
      return;
    }

    setSubmitting(true);
    try {
      if (isRegister) {
        await register({ email, password, displayName: name.trim() });
        showToast("<strong>账号已创建。</strong> 接下来用 4 步完成档案、目标和第一份计划。");
        router.push("/onboarding");
      } else {
        await login(email, password);
        showToast("<strong>登录成功。</strong> 正在加载你的真实计划和执行记录。");
        router.push("/today");
      }
    } catch (cause) {
      const error = cause instanceof ApiError ? cause : null;
      const code = error?.code ?? "";
      const message =
        code === "INVALID_CREDENTIALS"
          ? "邮箱或密码错误"
          : code === "EMAIL_ALREADY_EXISTS"
            ? "这个邮箱已经注册，请直接登录"
            : code === "RATE_LIMITED"
              ? "登录尝试过于频繁，请稍后再试"
              : error?.message ?? "无法连接后端，请确认 API 已启动";
      showToast(`<strong>操作失败。</strong> ${message}${error?.requestId ? `（${error.requestId}）` : ""}`, "risk");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Link className="brand" href="/login" aria-label="恒序 persistLog">
          <BrandMark />
          <span>
            <span className="brand-name">恒序</span>
            <span className="brand-sub">persistLog</span>
          </span>
        </Link>

        <div className="auth-story-copy">
          <span className="eyebrow eyebrow--light">Quiet Momentum</span>
          <h1>
            把计划，变成今天
            <br />
            能完成的事。
          </h1>
          <p>
            恒序不催你打卡。它只回答两个问题：今天做什么，以及做完之后，有没有更接近目标岗位。
          </p>
          <ul className="auth-points">
            <li>
              <Check className="icon" aria-hidden="true" />
              <span>导入一份 Markdown 计划，自动拆成阶段、周和每日任务</span>
            </li>
            <li>
              <Check className="icon" aria-hidden="true" />
              <span>按真实可用时间约束容量，宁可少而完成，不可多而崩溃</span>
            </li>
            <li>
              <Check className="icon" aria-hidden="true" />
              <span>企业微信推送今日重点，晚上汇总完成与顺延</span>
            </li>
          </ul>
        </div>

        <div className="auth-proof">
          <div className="auth-proof__item">
            <strong>3–6</strong>
            <span>每日任务项</span>
          </div>
          <div className="auth-proof__item">
            <strong>80%</strong>
            <span>默认容量系数</span>
          </div>
          <div className="auth-proof__item">
            <strong>5 类</strong>
            <span>企微通知事件</span>
          </div>
          <p className="auth-proof__quote">
            「不用每天整理待办。打开就是今天，做完就能看到路线往前挪了一点。」
          </p>
        </div>
      </section>

      <section className="auth-form-wrap">
        <div className="auth-card">
          <div className="auth-tabs" role="tablist" aria-label="登录或注册">
            <button
              className={cn("auth-tab", mode === "login" && "is-active")}
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              onClick={() => setMode("login")}
            >
              登录
            </button>
            <button
              className={cn("auth-tab", mode === "register" && "is-active")}
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              onClick={() => setMode("register")}
            >
              注册
            </button>
          </div>

          <h2>{isRegister ? "创建你的执行空间" : "继续你的执行节奏"}</h2>
          <p>{isRegister ? "先注册，再花 2 分钟完成档案、目标和第一份计划。" : "今天的计划还在等你，登录后从顺延任务开始。"}</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="auth-account">邮箱或手机号</label>
              <input
                id="auth-account"
                name="account"
                type="text"
                value={account}
                autoComplete="username"
                onChange={(event) => setAccount(event.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="auth-password">
                密码{" "}
                <button
                  className="card__link"
                  type="button"
                  onClick={() => showToast("<strong>密码找回将在正式版接入邮件服务。</strong>")}
                >
                  忘记密码？
                </button>
              </label>
              <input
                id="auth-password"
                name="password"
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            {isRegister ? (
              <>
                <div className="field">
                  <label htmlFor="auth-name">怎么称呼你</label>
                  <input
                    id="auth-name"
                    name="name"
                    type="text"
                    value={name}
                    placeholder="例如：林同学"
                    autoComplete="nickname"
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="auth-confirm">确认密码</label>
                  <input
                    id="auth-confirm"
                    name="confirm"
                    type="password"
                    value={confirm}
                    placeholder="再输入一次密码"
                    autoComplete="new-password"
                    onChange={(event) => setConfirm(event.target.value)}
                  />
                </div>
              </>
            ) : null}

            <div className="auth-row">
              <label className="check-row" style={{ marginTop: 0 }}>
                <input type="checkbox" defaultChecked />
                <span>保持登录 30 天</span>
              </label>
              <span>Refresh Token 存在 HttpOnly Cookie</span>
            </div>

            <Button variant="primary" className="btn--block" type="submit" disabled={submitting}>
              {submitting ? "处理中…" : isRegister ? "创建账号并开始引导" : "登录"}
            </Button>
          </form>

          <div className="auth-hint">
            <strong>联调模式：</strong>使用真实后端账号登录；开发环境已预填测试账号。注册后会进入档案与目标引导。
          </div>
          <div className="auth-hint">
            <strong>还没有账号？</strong> 点击上方「注册」，创建后会进入档案、目标和导入引导。
          </div>
          <p className="auth-legal">
            继续即表示同意《服务条款》与《隐私政策》。计划文本发送第三方 AI 解析前，会单独请求授权。
          </p>
        </div>
      </section>
    </div>
  );
}
