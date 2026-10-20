"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  Button as UwpButton,
  ContentDialog,
  Pivot,
  ProgressBar as UwpProgressBar,
} from "uwp_components";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn, STATUS_META } from "@/lib/utils";
import type { TaskStatus } from "@/lib/types";

const subscribeToClient = () => () => {};

function useMounted() {
  return useSyncExternalStore(
    subscribeToClient,
    () => true,
    () => false
  );
}

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

const UWP_BUTTON_VARIANT: Record<ButtonVariant, "standard" | "accent" | "quiet"> = {
  primary: "accent",
  secondary: "standard",
  ghost: "quiet",
  danger: "standard",
  light: "standard",
  "on-dark": "standard",
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
    <UwpButton
      type={type}
      variant={UWP_BUTTON_VARIANT[variant]}
      className={cn("btn", BUTTON_VARIANT[variant], BUTTON_SIZE[size], className)}
      {...props}
    >
      {children}
    </UwpButton>
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
    <UwpProgressBar
      value={Math.max(0, Math.min(100, value))}
      max={100}
      className={cn("progress-track", "uwp-progress", className)}
      style={color ? ({ "--accent": color } as CSSProperties) : undefined}
    />
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
    <div className="segmented uwp-pivot" role="group" aria-label={ariaLabel}>
      <Pivot
        tabs={options.map((option) => ({ key: String(option.value), label: option.label }))}
        value={String(value)}
        onChange={(key) => {
          const next = options.find((option) => String(option.value) === key);
          if (next) onChange(next.value);
        }}
      />
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
  return (
    <ContentDialog open={open} title={title} onClose={onClose}>
      <div className={cn("dialog-content", wide && "dialog-content--wide")}>
        {subtitle ? <p className="dialog-subtitle">{subtitle}</p> : null}
        {children}
        {footer ? <div className="modal__foot">{footer}</div> : null}
      </div>
    </ContentDialog>
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
  const mounted = useMounted();

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

function renderToastMessage(message: ReactNode): ReactNode {
  if (typeof message !== "string") return message;
  return message.split(/(<(?:strong|b)>[\s\S]*?<\/(?:strong|b)>)/g).map((part, index) => {
    const match = part.match(/^<(?:strong|b)>([\s\S]*)<\/(?:strong|b)>$/);
    return match ? <strong key={`toast-${index}`}>{match[1]}</strong> : part;
  });
}

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
          <span>{renderToastMessage(toast.message)}</span>
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
