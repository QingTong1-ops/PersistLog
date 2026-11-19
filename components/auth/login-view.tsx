"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AuthPlanPreview } from "@/components/auth/auth-plan-preview";
import { BrandMark } from "@/components/brand-mark";
import { Button, useToast } from "@/components/ui";
import { useAuth } from "@/lib/auth/auth-provider";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { IS_MOCK } from "@/lib/config/data-source";

type AuthMode = "login" | "register";

const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL ?? "";
const demoPassword = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "";

export function LoginView() {
  const router = useRouter();
  const { showToast } = useToast();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [account, setAccount] = useState(IS_MOCK ? "demo@persistlog.test" : demoEmail);
  const [password, setPassword] = useState(IS_MOCK ? "PreviewOnly!" : demoPassword);
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === "register";

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setFormError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const email = account.trim();
    setFormError("");
    if (!email || !email.includes("@")) {
      setFormError("请输入有效邮箱。");
      return;
    }
    if (password.length < 8) {
      setFormError("密码至少需要 8 位。");
      return;
    }
    if (isRegister && password !== confirm) {
      setFormError("两次输入的密码不一致。");
      return;
    }

    setSubmitting(true);
    try {
      if (isRegister) {
        await register({ email, password, displayName: name.trim() });
        showToast(IS_MOCK ? "<strong>已重置演示账户。</strong> 未创建真实账号。" : "<strong>账号已创建。</strong> 接下来设置档案、目标和第一份计划。");
        router.push("/onboarding");
      } else {
        await login(email, password);
        showToast(IS_MOCK ? "<strong>已进入演示账户。</strong> 所有操作仅用于预览。" : "<strong>登录成功。</strong> 正在加载你的计划和执行记录。");
        router.push("/today");
      }
    } catch (cause) {
      const error = cause instanceof ApiError ? cause : null;
      const message =
        error?.code === "INVALID_CREDENTIALS"
          ? "邮箱或密码错误。"
          : error?.code === "EMAIL_ALREADY_EXISTS"
            ? "这个邮箱已经注册，请直接登录。"
            : error?.code === "RATE_LIMITED"
              ? "尝试过于频繁，请稍后再试。"
              : error?.message ?? "服务暂时不可用，请稍后重试。";
      setFormError(`${message}${error?.requestId ? `（${error.requestId}）` : ""}`);
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
          <p>按可用时间安排任务，用完成记录看见目标进展。</p>
        </div>

        <AuthPlanPreview />
      </section>

      <section className="auth-form-wrap">
        <div className="auth-card">
          <div className="auth-tabs" role="tablist" aria-label="登录或注册">
            <button
              className={cn("auth-tab", mode === "login" && "is-active")}
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              onClick={() => changeMode("login")}
            >
              登录
            </button>
            <button
              className={cn("auth-tab", mode === "register" && "is-active")}
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              onClick={() => changeMode("register")}
            >
              注册
            </button>
          </div>

          <h2>{isRegister ? "创建账号" : "欢迎回来"}</h2>
          <p>{isRegister ? "注册后，设置你的目标和每日可用时间。" : "登录后继续今天的计划。"}</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="auth-account">邮箱</label>
              <input
                id="auth-account"
                name="account"
                type="email"
                value={account}
                placeholder="name@example.com"
                autoComplete="username"
                onChange={(event) => {
                  setAccount(event.target.value);
                  setFormError("");
                }}
              />
            </div>

            <div className="field">
              <label htmlFor="auth-password">密码</label>
              <div className="auth-password">
                <input
                  id="auth-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setFormError("");
                  }}
                />
                <button
                  className="auth-password__toggle"
                  type="button"
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
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
                    type={showPassword ? "text" : "password"}
                    value={confirm}
                    placeholder="再输入一次密码"
                    autoComplete="new-password"
                    onChange={(event) => {
                      setConfirm(event.target.value);
                      setFormError("");
                    }}
                  />
                </div>
              </>
            ) : null}

            {formError ? <p className="auth-form__error" role="alert">{formError}</p> : null}

            <Button variant="primary" className="btn--block auth-submit" type="submit" disabled={submitting}>
              {submitting ? <span className="auth-submit__spinner" aria-hidden="true" /> : null}
              {submitting ? (isRegister ? "创建中…" : "登录中…") : isRegister ? "创建账号" : "登录"}
            </Button>
          </form>

          {IS_MOCK ? (
            <div className="auth-hint">
              <strong>演示账户</strong>
              已预填虚拟账号；登录不校验真实账号，注册只重置本标签页演示数据。
            </div>
          ) : null}
          <p className="auth-legal">继续即表示同意《服务条款》与《隐私政策》。</p>
        </div>
      </section>
    </div>
  );
}
