"use client";

import { Check, ChevronDown, Copy, Pencil, Plus, Share2 } from "lucide-react";
import { useState } from "react";
import { sharesOf, type MemberSummary, type MonthSummary } from "@/lib/calc";
import type { Actions } from "@/lib/client";
import { formatK, formatMonth, formatVND } from "@/lib/format";
import { buildShareText, splitLabel } from "@/lib/share";
import { CATEGORIES, type AppData, type CategoryKey, type Expense, type ExpenseInput } from "@/lib/types";
import { CategoryBar, CategoryLegend } from "./category-bar";
import { Avatar, Button, CategoryIcon, categoryColor, cx, memberHue, toast } from "./ui";

type Props = {
  data: AppData;
  summary: MonthSummary;
  actions: Actions;
  onAdd: (category?: CategoryKey) => void;
  onEdit: (expense: Expense) => void;
};

export function MonthView({ data, summary, actions, onAdd, onEdit }: Props) {
  const memberName = (id: string) => data.members.find((m) => m.id === id)?.name ?? id;
  const meta = data.months.find((m) => m.month === summary.month);
  const empty = summary.expenses.length === 0;

  function togglePaid(id: string) {
    const paid = new Set(meta?.paid ?? []);
    if (paid.has(id)) paid.delete(id);
    else paid.add(id);
    actions.saveMonth({ month: summary.month, note: meta?.note ?? "", paid: [...paid] });
  }

  /** Bỏ qua / tính lại một người trong khoản chia đều; phần tiền chia lại cho những người còn lại */
  async function setSkipped(e: Expense, memberId: string, skip: boolean) {
    if (e.split.mode !== "equal") return;
    const ids = new Set(e.split.members);
    if (skip) ids.delete(memberId);
    else ids.add(memberId);
    if (!ids.size) return toast("Phải còn ít nhất 1 người trả khoản này", "error");
    const order = data.members.map((m) => m.id);
    const members = [...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const ok = await actions.updateExpense(e.id, {
      month: e.month,
      category: e.category,
      title: e.title,
      amount: e.amount,
      paidBy: e.paidBy,
      split: { mode: "equal", members },
      note: e.note,
    });
    if (ok) {
      toast(
        skip ? `${memberName(memberId)} không cần trả "${e.title}"` : `${memberName(memberId)} trả lại "${e.title}"`,
      );
    }
  }

  async function share() {
    const text = buildShareText(summary, memberName, window.location.origin);
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ text });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast("Đã sao chép, dán vào nhóm chat nhé");
    } catch {
      toast("Không sao chép được", "error");
    }
  }

  if (empty) return <EmptyMonth data={data} month={summary.month} actions={actions} onAdd={onAdd} />;

  const settled = summary.people.filter((p) => p.paid).length;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
      <div className="space-y-5 lg:sticky lg:top-24">
        {/* Tổng quan */}
        <section className="card animate-rise p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-ink-2">Tổng chi tháng {formatMonth(summary.month)}</p>
              <p className="tabular mt-1 text-[34px] font-bold leading-none tracking-tight">
                {formatVND(summary.total)}
              </p>
            </div>
            <Button size="sm" onClick={share} aria-label="Gửi cho nhóm" className="shrink-0">
              <Share2 className="size-4" />
              Gửi nhóm
            </Button>
          </div>
          <CategoryBar byCategory={summary.byCategory} height={12} className="mt-5" />
          <CategoryLegend byCategory={summary.byCategory} className="mt-3" />
          <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
            <div className="flex -space-x-1.5">
              {summary.people.map((p) => (
                <span
                  key={p.member.id}
                  className={cx("rounded-full ring-2 ring-surface transition", !p.paid && "opacity-35 grayscale")}
                >
                  <Avatar name={p.member.name} hue={memberHue(data.members, p.member.id)} size={26} />
                </span>
              ))}
            </div>
            <p className="text-sm text-ink-2">
              {settled === summary.people.length ? (
                <span className="font-medium text-good">Mọi người đã đóng đủ 🎉</span>
              ) : (
                <>
                  Đã đóng <span className="font-semibold text-ink">{settled}</span>/{summary.people.length} người
                </>
              )}
            </p>
          </div>
        </section>

        <MonthNote month={summary.month} meta={meta} actions={actions} />

        {/* Mỗi người */}
        <section className="space-y-2.5">
          <h2 className="px-1 text-[15px] font-semibold">Mỗi người cần đóng</h2>
          {summary.people.map((p, i) => (
            <PersonCard
              key={p.member.id}
              person={p}
              hue={memberHue(data.members, p.member.id)}
              skipped={summary.expenses.filter(
                (e) => e.split.mode === "equal" && !e.split.members.includes(p.member.id),
              )}
              onTogglePaid={() => togglePaid(p.member.id)}
              onSkip={(e, skip) => setSkipped(e, p.member.id, skip)}
              delay={i * 40}
            />
          ))}
        </section>
      </div>

      {/* Khoản chi */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[15px] font-semibold">
            Khoản chi <span className="font-normal text-muted">({summary.expenses.length})</span>
          </h2>
          <Button size="sm" variant="ghost" onClick={() => onAdd()} className="hidden sm:inline-flex">
            <Plus className="size-4" /> Thêm
          </Button>
        </div>
        <div className="card divide-y divide-line overflow-hidden">
          {summary.expenses.map((e) => (
            <ExpenseRow
              key={e.id}
              expense={e}
              sub={[splitLabel(summary, e.id, memberName), e.paidBy && `${memberName(e.paidBy)} trả trước`]
                .filter(Boolean)
                .join(" · ")}
              perHead={
                e.split.mode === "equal" && e.split.members.length > 1 ? e.amount / e.split.members.length : null
              }
              onClick={() => onEdit(e)}
            />
          ))}
        </div>
        <QuickAdd onAdd={onAdd} />
      </section>
    </div>
  );
}

function ExpenseRow({
  expense: e,
  sub,
  perHead,
  onClick,
}: {
  expense: Expense;
  sub: string;
  perHead: number | null;
  onClick: () => void;
}) {
  const pending = e.id.startsWith("tmp-");
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={cx(
        "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-2/60 active:bg-surface-2",
        pending && "opacity-60",
      )}
    >
      <CategoryIcon category={e.category} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{e.title || "Khoản chi"}</p>
        <p className="truncate text-[13px] text-muted">
          {sub}
          {e.note && ` · ${e.note}`}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={cx("tabular font-semibold", e.amount < 0 && "text-good")}>{formatVND(e.amount)}</p>
        {perHead !== null && <p className="tabular text-[13px] text-muted">{formatK(perHead)}/người</p>}
      </div>
    </button>
  );
}

function PersonCard({
  person: p,
  hue,
  skipped,
  onTogglePaid,
  onSkip,
  delay,
}: {
  person: MemberSummary;
  hue: number;
  /** các khoản chia đều mà người này được bỏ qua */
  skipped: Expense[];
  onTogglePaid: () => void;
  onSkip: (expense: Expense, skip: boolean) => void;
  delay: number;
}) {
  const [open, setOpen] = useState(false);
  const receive = p.due < -0.004;
  const living = p.total - p.byCategory.nha;
  const summaryLine = [
    p.byCategory.nha ? `Nhà ${formatK(p.byCategory.nha)}` : null,
    living ? `Sinh hoạt ${formatK(living)}` : null,
    p.advanced ? `Đã trả trước −${formatK(p.advanced)}` : null,
    skipped.length ? `Bỏ qua ${skipped.length} khoản` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="card animate-rise overflow-hidden" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start gap-2 py-3.5 pl-4 pr-2.5">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <Avatar name={p.member.name} hue={hue} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-[15px]">
              <span className="truncate font-semibold">{p.member.name}</span>
              <ChevronDown
                className={cx("size-4 shrink-0 text-muted transition-transform duration-300", open && "rotate-180")}
              />
            </div>
            <p
              className={cx(
                "tabular text-[22px] font-bold leading-tight tracking-tight transition-colors",
                p.paid && "text-muted",
              )}
            >
              {receive && <span className="mr-1.5 text-sm font-semibold text-good">Nhận lại</span>}
              {formatVND(Math.abs(p.due))}
            </p>
            <p className="mt-0.5 truncate text-[13px] text-muted">{summaryLine}</p>
          </div>
        </button>
        <button
          type="button"
          onClick={onTogglePaid}
          aria-pressed={p.paid}
          aria-label={p.paid ? "Bỏ đánh dấu đã đóng" : "Đánh dấu đã đóng"}
          className="group flex w-16 shrink-0 flex-col items-center gap-1 pt-1"
        >
          <span
            className={cx(
              "grid size-10 place-items-center rounded-full transition duration-200 group-active:scale-90",
              p.paid ? "bg-good text-white" : "text-muted/50 ring-2 ring-inset ring-line-strong group-hover:text-muted",
            )}
          >
            <Check className="size-5" strokeWidth={3} />
          </span>
          <span className={cx("text-[11px] font-medium", p.paid ? "text-good" : "text-muted")}>
            {p.paid ? (receive ? "Đã nhận" : "Đã đóng") : receive ? "Chưa nhận" : "Chưa đóng"}
          </span>
        </button>
      </div>

      <div
        className={cx(
          "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="mx-4 mb-4 space-y-1.5 rounded-2xl bg-surface-2 p-3 text-sm">
            <p className="pb-1 text-xs text-muted">
              Bấm <b className="font-semibold">Bỏ qua</b> nếu {p.member.name} không cần trả khoản đó, phần tiền sẽ chia
              lại cho những người còn lại.
            </p>
            {p.items.map(({ expense, share }) => {
              const canSkip =
                expense.split.mode === "equal" && expense.split.members.length > 1 && !expense.id.startsWith("tmp-");
              return (
                <div key={expense.id} className="flex min-h-8 items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: categoryColor(expense.category) }}
                  />
                  <span className="flex-1 truncate text-ink-2">{expense.title}</span>
                  <span className="tabular">{formatVND(share)}</span>
                  <SkipButton
                    disabled={!canSkip}
                    title={
                      expense.split.mode === "custom"
                        ? "Khoản chia riêng: sửa số tiền trong khoản chi"
                        : canSkip
                          ? undefined
                          : "Khoản chỉ còn 1 người trả"
                    }
                    onClick={() => onSkip(expense, true)}
                  >
                    Bỏ qua
                  </SkipButton>
                </div>
              );
            })}
            {skipped.length > 0 && (
              <div className="space-y-1.5 border-t border-line pt-2">
                <p className="text-xs font-medium text-muted">Không cần trả</p>
                {skipped.map((expense) => (
                  <div key={expense.id} className="flex min-h-8 items-center gap-2 text-muted">
                    <span
                      className="size-2 shrink-0 rounded-full opacity-40"
                      style={{ background: categoryColor(expense.category) }}
                    />
                    <span className="flex-1 truncate line-through decoration-1">{expense.title}</span>
                    <span className="tabular">0đ</span>
                    <SkipButton
                      tone="restore"
                      disabled={expense.id.startsWith("tmp-")}
                      onClick={() => onSkip(expense, false)}
                    >
                      Tính lại
                    </SkipButton>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-1.5 font-medium">
              <span>Phần của {p.member.name}</span>
              <span className="tabular">{formatVND(p.total)}</span>
            </div>
            {p.advanced !== 0 && (
              <div className="flex justify-between text-good">
                <span>Đã trả trước cho nhà</span>
                <span className="tabular">−{formatVND(p.advanced)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-1.5 font-semibold">
              <span>{receive ? "Được nhận lại" : "Cần đóng"}</span>
              <span className="tabular">{formatVND(Math.abs(p.due))}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkipButton({
  children,
  onClick,
  disabled,
  title,
  tone = "skip",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  tone?: "skip" | "restore";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cx(
        "h-7 w-[68px] shrink-0 rounded-full text-xs font-medium ring-1 transition active:scale-95 disabled:pointer-events-none disabled:opacity-30",
        tone === "skip"
          ? "text-ink-2 ring-line-strong hover:bg-surface hover:text-danger"
          : "bg-surface text-ink ring-line-strong hover:text-good",
      )}
    >
      {children}
    </button>
  );
}

function MonthNote({
  month,
  meta,
  actions,
}: {
  month: string;
  meta: AppData["months"][number] | undefined;
  actions: Actions;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(meta?.note ?? "");
  const note = meta?.note ?? "";

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(note);
          setEditing(true);
        }}
        className="flex w-full items-center gap-2 rounded-2xl px-4 py-2.5 text-left text-sm text-ink-2 border border-dashed border-line-strong transition hover:bg-surface"
      >
        <Pencil className="size-3.5 shrink-0 text-muted" />
        <span className={cx("flex-1", !note && "text-muted")}>{note || "Thêm ghi chú cho tháng này…"}</span>
      </button>
    );
  }
  return (
    <form
      className="card flex items-center gap-2 p-2"
      onSubmit={(e) => {
        e.preventDefault();
        setEditing(false);
        if (value.trim() !== note) actions.saveMonth({ month, note: value.trim(), paid: meta?.paid ?? [] });
      }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ví dụ: chủ nhà giảm 1tr"
        className="input h-10 flex-1"
        maxLength={500}
      />
      <Button type="submit" variant="primary" size="md">
        Lưu
      </Button>
    </form>
  );
}

function QuickAdd({ onAdd }: { onAdd: (c?: CategoryKey) => void }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {CATEGORIES.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onAdd(c.key)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] font-medium text-ink-2 ring-1 ring-line transition hover:text-ink active:scale-95"
        >
          <Plus className="size-3.5" style={{ color: categoryColor(c.key) }} strokeWidth={3} />
          {c.defaultTitle || "Khoản khác"}
        </button>
      ))}
    </div>
  );
}

function EmptyMonth({
  data,
  month,
  actions,
  onAdd,
}: {
  data: AppData;
  month: string;
  actions: Actions;
  onAdd: (c?: CategoryKey) => void;
}) {
  const prevMonth = [...new Set(data.expenses.map((e) => e.month))]
    .filter((m) => m < month)
    .sort()
    .at(-1);
  const prevItems = data.expenses.filter((e) => e.month === prevMonth);
  const [picked, setPicked] = useState<Set<string>>(
    () =>
      new Set(prevItems.filter((e) => ["nha", "phiql", "xe"].includes(e.category) && e.amount > 0).map((e) => e.id)),
  );
  const [busy, setBusy] = useState(false);

  async function copy() {
    const inputs: ExpenseInput[] = prevItems
      .filter((e) => picked.has(e.id))
      .map((e) => ({
        month,
        category: e.category,
        title: e.title,
        amount: e.amount,
        paidBy: null,
        split: activeSplit(e, data),
        note: "",
      }));
    setBusy(true);
    const ok = await actions.createExpenses(inputs);
    setBusy(false);
    if (ok) toast(`Đã sao chép ${inputs.length} khoản`);
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <section className="card animate-rise p-6 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface-2 text-2xl">🧾</div>
        <h2 className="mt-4 text-lg font-semibold">Tháng {formatMonth(month)} chưa có khoản chi nào</h2>
        <p className="mt-1 text-sm text-ink-2">Thêm tiền nhà, điện, nước… app sẽ tự chia cho từng người.</p>
        <Button variant="primary" size="lg" className="mt-5" onClick={() => onAdd()}>
          <Plus className="size-5" /> Thêm khoản chi
        </Button>
      </section>

      {prevMonth && prevItems.length > 0 && (
        <section className="card animate-rise p-5" style={{ animationDelay: "60ms" }}>
          <div className="flex items-center gap-2">
            <Copy className="size-4 text-muted" />
            <h3 className="font-semibold">Sao chép từ tháng {formatMonth(prevMonth)}</h3>
          </div>
          <p className="mt-1 text-sm text-ink-2">
            Các khoản cố định như tiền nhà, phí quản lý thường giống tháng trước.
          </p>
          <div className="mt-4 divide-y divide-line overflow-hidden rounded-2xl ring-1 ring-line">
            {prevItems.map((e) => {
              const on = picked.has(e.id);
              return (
                <label
                  key={e.id}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition hover:bg-surface-2/60"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => {
                      const next = new Set(picked);
                      if (on) next.delete(e.id);
                      else next.add(e.id);
                      setPicked(next);
                    }}
                    className="size-[18px] accent-[var(--primary)]"
                  />
                  <CategoryIcon category={e.category} size={30} />
                  <span className="flex-1 truncate text-sm font-medium">{e.title}</span>
                  <span className="tabular text-sm text-ink-2">{formatVND(e.amount)}</span>
                </label>
              );
            })}
          </div>
          <Button variant="secondary" size="lg" className="mt-4 w-full" disabled={!picked.size || busy} onClick={copy}>
            Sao chép {picked.size} khoản sang tháng {formatMonth(month)}
          </Button>
        </section>
      )}

      <QuickAdd onAdd={onAdd} />
    </div>
  );
}

/** Khi sao chép, bỏ những người đã chuyển đi khỏi cách chia đều */
function activeSplit(e: Expense, data: AppData): Expense["split"] {
  if (e.split.mode === "custom") return e.split;
  const active = e.split.members.filter((id) => data.members.find((m) => m.id === id)?.active !== false);
  return { mode: "equal", members: active.length ? active : Object.keys(sharesOf(e)) };
}
