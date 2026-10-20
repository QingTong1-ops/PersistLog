"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { useAuth } from "@/lib/auth/auth-provider";

export function SessionGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login");
    }
  }, [router, status]);

  if (status === "loading") {
    return (
      <div className="session-loading">
        <span className="brand">
          <BrandMark />
          <span>
            <span className="brand-name">恒序</span>
            <span className="brand-sub">persistLog</span>
          </span>
        </span>
        <div className="skeleton skeleton--title" />
        <div className="skeleton skeleton--hero" />
        <p>正在读取登录状态与今日计划…</p>
      </div>
    );
  }

  if (status === "anonymous") return null;
  return <>{children}</>;
}
