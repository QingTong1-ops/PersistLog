"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { cn, STATUS_META } from "@/lib/utils";
import type { TaskStatus } from "@/lib/types";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "light" | "on-dark";
type ButtonSize = "md" | "sm" | "xs";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "btn--primary",
  secondary: "btn--secondary",
  ghost: "btn--ghost",
  danger: "btn--danger",
  light: "btn--light",
  "on-dark": "btn--on-dark",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  md: "",
  sm: "btn--sm",
  xs: "btn--xs",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      type={type}
      className={cn("btn", BUTTON_VARIANT[variant], BUTTON_SIZE[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({
  className,
  type = "button",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={cn("icon-button", className)} {...props}>
      {children}
    </button>
  );
}

export function Tag({
  children,
  variant = "neutral",
  className,
}: {
  children: ReactNode;
  variant?: "brand" | "teal" | "amber" | "coral" | "sky" | "neutral" | "outline";
  className?: string;
}) {
  return <span className={cn("tag", `tag--${variant}`, className)}>{children}</span>;
}

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const meta = STATUS_META[status];
  return <span className={cn("status", meta.className, className)}>{meta.label}</span>;
}

export function ProgressBar({
  value,
  className,
  color,
}: {
  value: number;
  className?: string;
  color?: string;
}) {
  return (
    <div className={cn("progress-track", className)}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

export function ProgressRing({
  percent,
  size = 108,
  label = "今日完成",
  className,
}: {
  percent: number;
  size?: number;
  label?: string;
  className?: string;
}) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  return (
    <div className={cn("ring", className)} style={{ width: size, height: size }} role="img" aria-label={`${label} ${percent}%`}>
      <svg viewBox="0 0 108 108" aria-hidden="true">
        <circle cx="54" cy="54" r={radius} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="7" />
        <circle
          cx="54"
          cy="54"
          r={radius}
          fill="none"
          stroke="#79d9cb"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset .45s ease" }}
        />
      </svg>
      <div className="ring__center">
        <strong>{percent}%</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      className={cn("toggle", checked && "is-on")}
      type="button"
      aria-label={label}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
    >
      <i />
    </button>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          className={option.value === value ? "is-active" : undefined}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  side,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  side?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {side ? <div className="page-head__side">{side}</div> : null}
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  actions,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon">{icon}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {actions ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 16 }}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add("no-scroll");
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    const timer = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(
        "input, select, textarea, button:not([data-close-modal])"
      );
      first?.focus();
    }, 40);
    return () => {
      document.body.classList.remove("no-scroll");
      document.removeEventListener("keydown", handleKey);
      window.clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      data-modal-backdrop
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panelRef}
        className={cn("modal", wide && "modal--wide")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal__head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <IconButton type="button" onClick={onClose} aria-label="关闭弹窗" data-close-modal>
            <X className="icon" aria-hidden="true" />
          </IconButton>
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__foot">{footer}</div> : null}
      </section>
    </div>,
    document.body
  );
}

export function Sheet({
  open,
  onClose,
  children,
  label,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add("no-scroll");
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.classList.remove("no-scroll");
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="sheet is-open" aria-hidden={false} aria-label={label}>
        {children}
      </aside>
    </>,
    document.body
  );
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  subtitle,
  body,
  confirmText = "确认",
  tone = "danger",
  onConfirm,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  body: ReactNode;
  confirmText?: string;
  tone?: "primary" | "danger";
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            size="sm"
            onClick={onConfirm}
            disabled={loading}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      {body}
    </Modal>
  );
}

type ToastTone = "success" | "risk";

const ToastContext = createContext<{
  showToast: (message: ReactNode, tone?: ToastTone) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: ReactNode; tone: ToastTone; key: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const showToast = useCallback((message: ReactNode, tone: ToastTone = "success") => {
    setToast({ message, tone, key: Date.now() });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 3800);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast ? (
        <div
          key={toast.key}
          className={cn("toast", "is-show", toast.tone === "risk" && "is-risk")}
          role="status"
          aria-live="polite"
        >
          {toast.tone === "risk" ? (
            <AlertCircle className="icon" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="icon" aria-hidden="true" />
          )}
          <span>{toast.message}</span>
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
