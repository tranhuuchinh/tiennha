"use client";

import { Bike, Building2, Droplets, House, Package, X, Zap, type LucideIcon } from "lucide-react";
import { useEffect, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { CategoryKey, Member } from "@/lib/types";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------ Bottom sheet ------------------------------ */

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const [rendered, setRendered] = useState(open);
  if (open && !rendered) setRendered(true);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!rendered) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div
        className={cx("absolute inset-0 bg-black/45 backdrop-blur-[2px]", open ? "overlay-in" : "overlay-out")}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-surface shadow-2xl sm:max-w-lg sm:rounded-[28px]",
          open ? "sheet-in" : "sheet-out",
        )}
        onAnimationEnd={(e) => {
          if (!open && e.target === e.currentTarget) setRendered(false);
        }}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-surface-3 sm:hidden" />
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-3 sm:pt-5">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="-mr-2 grid size-9 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-line bg-surface px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* --------------------------------- Button --------------------------------- */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

export function Button({ variant = "secondary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "inline-flex select-none items-center justify-center gap-2 rounded-full font-medium transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "h-8 px-3 text-sm",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-5 text-base",
        variant === "primary" && "bg-primary text-primary-ink hover:opacity-90",
        variant === "secondary" && "bg-surface-2 text-ink hover:bg-surface-3",
        variant === "ghost" && "text-ink-2 hover:bg-surface-2 hover:text-ink",
        variant === "danger" && "bg-danger-soft text-danger hover:brightness-95",
        className,
      )}
    />
  );
}

/* ------------------------------- Segmented -------------------------------- */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  const index = options.findIndex((o) => o.value === value);
  return (
    <div
      className={cx("relative grid rounded-full bg-surface-2 p-1", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      <div
        className="absolute inset-y-1 left-1 rounded-full bg-surface shadow-card ring-1 ring-line transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
        style={{ width: `calc((100% - 8px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={cx(
            "relative z-10 h-8 whitespace-nowrap rounded-full px-3 text-sm font-medium transition-colors",
            o.value === value ? "text-ink" : "text-muted hover:text-ink-2",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------- Avatar --------------------------------- */

const AVATAR_HUES = [205, 22, 160, 275, 340, 48, 120, 0];

export function memberHue(members: Member[], id: string) {
  const i = members.findIndex((m) => m.id === id);
  return AVATAR_HUES[(i === -1 ? id.length : i) % AVATAR_HUES.length];
}

export function Avatar({ name, hue, size = 36 }: { name: string; hue: number; size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `light-dark(hsl(${hue} 75% 92%), hsl(${hue} 35% 24%))`,
        color: `light-dark(hsl(${hue} 55% 30%), hsl(${hue} 80% 82%))`,
      }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/* ---------------------------- Category visuals ---------------------------- */

export const CATEGORY_ICON: Record<CategoryKey, LucideIcon> = {
  nha: House,
  dien: Zap,
  nuoc: Droplets,
  phiql: Building2,
  xe: Bike,
  khac: Package,
};

export const categoryColor = (key: CategoryKey) => `var(--c-${key})`;

export function CategoryIcon({ category, size = 40 }: { category: CategoryKey; size?: number }) {
  const Icon = CATEGORY_ICON[category];
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-2xl"
      style={{
        width: size,
        height: size,
        color: categoryColor(category),
        background: `color-mix(in oklab, ${categoryColor(category)} 14%, transparent)`,
      }}
    >
      <Icon style={{ width: size * 0.48, height: size * 0.48 }} strokeWidth={2.2} />
    </span>
  );
}

/* --------------------------------- Toasts --------------------------------- */

type Toast = { id: number; message: string; tone: "default" | "error" };
let toasts: Toast[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(message: string, tone: Toast["tone"] = "default") {
  const id = Date.now() + Math.random();
  toasts = [...toasts.slice(-2), { id, message, tone }];
  emit();
  setTimeout(
    () => {
      toasts = toasts.filter((t) => t.id !== id);
      emit();
    },
    tone === "error" ? 5000 : 2200,
  );
}

const EMPTY: Toast[] = [];

export function Toaster() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => EMPTY,
  );
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-8">
      {list.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cx(
            "animate-rise max-w-sm rounded-full px-4 py-2.5 text-sm font-medium shadow-lg",
            t.tone === "error" ? "bg-danger text-white" : "bg-primary text-primary-ink",
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
