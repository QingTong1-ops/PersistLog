"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "register";

export function LoginView() {
  const router = useRouter();
  const { showToast } = useToast();
  const [mode, setMode] = useState<AuthMode>("login");
  const [account, setAccount] = useState("lin@example.com");
  const [password, setPassword] = useState("persistlog");
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === "register";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      if (isRegister) {
        showToast("<strong>账号已创建。</strong> 接下来用 4 步完成档案、目标和第一份计划。");
        router.push("/onboarding");
      } else {
        showToast("<strong>登录成功。</strong> 今天的计划已经准备好了。");
        router.push("/today");
      }
    }, 450);
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
            <strong>开发预览：</strong>无需真实账号。点击「登录」进入今日页，点击「注册」进入首次引导。
          </div>
          <div className="auth-divider">
            <span>或</span>
          </div>
          <Link className="btn btn--secondary btn--block" href="/onboarding">
            先看首次使用引导
          </Link>
          <p className="auth-legal">
            继续即表示同意《服务条款》与《隐私政策》。计划文本发送第三方 AI 解析前，会单独请求授权。
          </p>
        </div>
      </section>
    </div>
  );
}
