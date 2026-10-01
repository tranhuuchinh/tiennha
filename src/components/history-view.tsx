"use client";

import { ChevronRight } from "lucide-react";
import { allMonths, emptyByCategory, summarizeMonth } from "@/lib/calc";
import { formatMonth, formatShort, formatVND } from "@/lib/format";
import { CATEGORIES, type AppData } from "@/lib/types";
import { CategoryBar, CategoryLegend } from "./category-bar";
import { Avatar, cx, memberHue } from "./ui";

export function HistoryView({ data, onOpen }: { data: AppData; onOpen: (month: string) => void }) {
  const summaries = allMonths(data)
    .map((m) => summarizeMonth(data, m))
    .filter((s) => s.expenses.length)
    .reverse();

  if (!summaries.length) {
    return <p className="card p-8 text-center text-ink-2">Chưa có dữ liệu.</p>;
  }

  const max = Math.max(...summaries.map((s) => s.total));
  const grand = summaries.reduce((a, s) => a + s.total, 0);
  const byCategory = emptyByCategory();
  for (const s of summaries) for (const c of CATEGORIES) byCategory[c.key] += s.byCategory[c.key];

  // Tổng mỗi người đã chịu qua các tháng
  const perMember = data.members
    .map((m) => ({
      member: m,
      total: summaries.reduce((a, s) => a + (s.people.find((p) => p.member.id === m.id)?.total ?? 0), 0),
    }))
    .filter((x) => x.total);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-start">
      <section className="card animate-rise space-y-4 p-5 lg:sticky lg:top-24">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-ink-2">Tổng {summaries.length} tháng</p>
            <p className="tabular mt-1 text-2xl font-bold tracking-tight">{formatVND(grand)}</p>
          </div>
          <div>
            <p className="text-sm text-ink-2">Trung bình / tháng</p>
            <p className="tabular mt-1 text-2xl font-bold tracking-tight">{formatVND(grand / summaries.length)}</p>
          </div>
        </div>
        <CategoryBar byCategory={byCategory} height={12} />
        <CategoryLegend byCategory={byCategory} />
        <div className="space-y-2 border-t border-line pt-4">
          <p className="text-sm font-medium text-ink-2">Mỗi người đã chi</p>
          {perMember.map(({ member, total }) => (
            <div key={member.id} className="flex items-center gap-3">
              <Avatar name={member.name} hue={memberHue(data.members, member.id)} size={28} />
              <span className="flex-1 text-sm font-medium">{member.name}</span>
              <span className="tabular text-sm font-semibold">{formatVND(total)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2.5">
        <h2 className="px-1 text-[15px] font-semibold">Theo tháng</h2>
        <div className="card divide-y divide-line overflow-hidden">
          {summaries.map((s, i) => (
            <button
              key={s.month}
              type="button"
              onClick={() => onOpen(s.month)}
              className="animate-rise group block w-full px-4 py-3.5 text-left transition hover:bg-surface-2/60"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">Tháng {formatMonth(s.month)}</span>
                <span className="flex items-center gap-1">
                  <span className="tabular font-semibold">{formatVND(s.total)}</span>
                  <ChevronRight className="size-4 text-muted transition group-hover:translate-x-0.5" />
                </span>
              </div>
              <CategoryBar
                byCategory={s.byCategory}
                scale={s.total / max}
                height={8}
                className="mt-2.5"
                interactive={false}
              />
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                {s.people.map((p) => (
                  <span key={p.member.id} className={cx("tabular", p.paid ? "text-muted" : "text-ink-2")}>
                    {p.member.name} <span className="font-medium text-ink">{formatShort(p.due)}</span>
                    {!p.paid && <span className="ml-1 text-[11px] text-danger">●</span>}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
        <p className="px-1 text-xs text-muted">
          <span className="text-danger">●</span> chưa đóng · Bấm vào một tháng để xem chi tiết
        </p>
      </section>
    </div>
  );
}
