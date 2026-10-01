"use client";

import { useState } from "react";
import { formatShort, formatVND } from "@/lib/format";
import { CATEGORIES, type CategoryKey } from "@/lib/types";
import { categoryColor, cx } from "./ui";

type Props = {
  byCategory: Record<CategoryKey, number>;
  /** độ dài thanh so với khung (0–1), để nhiều tháng dùng chung thang đo */
  scale?: number;
  height?: number;
  className?: string;
  /** false khi thanh nằm trong một nút khác (không được lồng button) */
  interactive?: boolean;
};

export function CategoryBar({ byCategory, scale = 1, height = 10, className, interactive = true }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const parts = CATEGORIES.map((c) => ({ ...c, value: byCategory[c.key] })).filter((p) => p.value > 0);
  const sum = parts.reduce((a, p) => a + p.value, 0);
  if (!sum) return <div className={cx("rounded-full bg-surface-2", className)} style={{ height }} />;

  const widths = parts.map((p) => (p.value / sum) * 100);
  const segments = parts.map((p, i) => ({
    ...p,
    width: widths[i],
    center: widths.slice(0, i).reduce((a, w) => a + w, 0) + widths[i] / 2,
  }));
  const active = hover === null ? null : segments[hover];

  return (
    <div className={cx("relative", className)} onMouseLeave={() => setHover(null)}>
      <div
        className="flex gap-[2px] overflow-hidden rounded-[4px] transition-[width] duration-500"
        style={{ height, width: `${Math.max(scale, 0.02) * 100}%` }}
      >
        {segments.map((s, i) =>
          !interactive ? (
            <span
              key={s.key}
              title={`${s.label}: ${formatVND(s.value)}`}
              className="h-full min-w-[3px]"
              style={{ width: `${s.width}%`, background: categoryColor(s.key) }}
            />
          ) : (
            <button
              key={s.key}
              type="button"
              aria-label={`${s.label}: ${formatVND(s.value)}`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onClick={(e) => {
                e.stopPropagation();
                setHover(hover === i ? null : i);
              }}
              className={cx("h-full min-w-[3px] transition-opacity", hover !== null && hover !== i && "opacity-40")}
              style={{ width: `${s.width}%`, background: categoryColor(s.key) }}
            />
          ),
        )}
      </div>
      {active && (
        <div
          className="animate-fade pointer-events-none absolute bottom-full z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-primary px-2.5 py-1.5 text-xs text-primary-ink shadow-lg"
          style={{ left: `clamp(48px, ${active.center * scale}%, calc(100% - 48px))` }}
        >
          <span className="font-semibold">{active.label}</span> · {formatVND(active.value)} ·{" "}
          {Math.round((active.value / sum) * 100)}%
        </div>
      )}
    </div>
  );
}

export function CategoryLegend({
  byCategory,
  className,
}: {
  byCategory: Record<CategoryKey, number>;
  className?: string;
}) {
  const parts = CATEGORIES.filter((c) => byCategory[c.key] !== 0);
  return (
    <ul className={cx("flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]", className)}>
      {parts.map((c) => (
        <li key={c.key} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: categoryColor(c.key) }} />
          <span className="text-ink-2">{c.label}</span>
          <span className="tabular font-medium text-ink">{formatShort(byCategory[c.key])}</span>
        </li>
      ))}
    </ul>
  );
}
