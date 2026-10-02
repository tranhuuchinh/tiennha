"use client";

import { Check, Lock } from "lucide-react";
import { useState } from "react";
import { summarizeMonth } from "@/lib/calc";
import type { Actions } from "@/lib/client";
import { formatVND } from "@/lib/format";
import type { AppData, Expense, ExpenseInput } from "@/lib/types";
import { Avatar, Button, CategoryIcon, cx, memberHue, toast } from "./ui";

export type PayItemsState = { key: number; memberId: string };

/** Khoản chia đều mà người này không thể bỏ (chỉ còn mình họ trả) */
const onlyPayer = (e: Expense, id: string) =>
  e.split.mode === "equal" && e.split.members.length === 1 && e.split.members[0] === id;

function withMember(e: Expense, id: string, pays: boolean, order: string[]): Expense {
  if (e.split.mode !== "equal") return e;
  const ids = new Set(e.split.members);
  if (pays) ids.add(id);
  else ids.delete(id);
  const members = [...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return { ...e, split: { mode: "equal", members } };
}

/** Chọn những khoản một người phải trả trong tháng; khoản bỏ chọn sẽ chia lại cho những người còn lại */
export function PayItemsForm({
  data,
  month,
  memberId,
  actions,
  onDone,
}: {
  data: AppData;
  month: string;
  memberId: string;
  actions: Actions;
  onDone: () => void;
}) {
  const name = data.members.find((m) => m.id === memberId)?.name ?? memberId;
  const order = data.members.map((m) => m.id);
  const current = summarizeMonth(data, month);
  const expenses = current.expenses;
  const equal = expenses.filter((e) => e.split.mode === "equal");
  const isPaying = (e: Expense) => e.split.mode === "equal" && e.split.members.includes(memberId);

  const [checked, setChecked] = useState(() => new Set(equal.filter(isPaying).map((e) => e.id)));

  const draft = expenses.map((e) => withMember(e, memberId, checked.has(e.id), order));
  const preview = summarizeMonth(
    { ...data, expenses: [...data.expenses.filter((e) => e.month !== month), ...draft] },
    month,
  );
  const before = current.people.find((p) => p.member.id === memberId);
  const after = preview.people.find((p) => p.member.id === memberId);
  const changed = equal.filter((e) => checked.has(e.id) !== isPaying(e));
  // "Chọn hết / Bỏ chọn hết" chỉ áp dụng cho khoản phải trả, không đụng khoản giảm trừ
  const toggleable = equal.filter((e) => e.amount > 0 && !onlyPayer(e, memberId) && !e.id.startsWith("tmp-"));

  function setAll(on: boolean) {
    const next = new Set(checked);
    for (const e of toggleable) {
      if (on) next.add(e.id);
      else next.delete(e.id);
    }
    setChecked(next);
  }

  async function save() {
    if (!changed.length) return onDone();
    const updates = changed.map((e) => {
      const next = withMember(e, memberId, checked.has(e.id), order);
      const input: ExpenseInput = {
        month: next.month,
        category: next.category,
        title: next.title,
        amount: next.amount,
        paidBy: next.paidBy,
        split: next.split,
        note: next.note,
      };
      return { id: e.id, input };
    });
    onDone();
    if (await actions.updateExpenses(updates)) toast(`Đã cập nhật khoản ${name} phải trả`);
  }

  const due = after?.due ?? 0;
  const paying = draft.filter((e) =>
    e.split.mode === "custom" ? Boolean(e.split.shares[memberId]) : e.split.members.includes(memberId),
  ).length;
  const delta = due - (before?.due ?? 0);

  return (
    <div className="space-y-4 pt-1">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-2">
          Tick những khoản {name} cần trả. Khoản bỏ tick sẽ chia cho những người còn lại.
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setAll(true)}>
          Chọn hết
        </Button>
        <Button size="sm" onClick={() => setAll(false)}>
          Bỏ chọn hết
        </Button>
      </div>

      <div className="divide-y divide-line overflow-hidden rounded-2xl ring-1 ring-line">
        {expenses.map((e, i) => {
          const custom = e.split.mode === "custom";
          const locked = custom || onlyPayer(e, memberId) || e.id.startsWith("tmp-");
          const on = custom ? Boolean(e.split.mode === "custom" && e.split.shares[memberId]) : checked.has(e.id);
          const share =
            preview.people.find((p) => p.member.id === memberId)?.items.find((it) => it.expense.id === e.id)?.share ??
            0;
          const hint = custom
            ? "Chia riêng · sửa trong khoản chi"
            : onlyPayer(e, memberId)
              ? `Chỉ mình ${name} trả`
              : `${(draft[i].split as { members: string[] }).members.length} người chia`;
          return (
            <label
              key={e.id}
              className={cx(
                "flex items-center gap-3 bg-surface px-3 py-2.5 transition",
                locked ? "cursor-default" : "cursor-pointer hover:bg-surface-2/60",
              )}
            >
              <input
                type="checkbox"
                className="peer sr-only"
                checked={on}
                disabled={locked}
                onChange={() => {
                  const next = new Set(checked);
                  if (on) next.delete(e.id);
                  else next.add(e.id);
                  setChecked(next);
                }}
              />
              <span
                aria-hidden
                className={cx(
                  "grid size-6 shrink-0 place-items-center rounded-lg transition peer-focus-visible:ring-2 peer-focus-visible:ring-ink/30",
                  on ? "bg-primary text-primary-ink" : "ring-2 ring-inset ring-line-strong",
                  locked && "opacity-40",
                )}
              >
                {locked ? (
                  <Lock className="size-3" strokeWidth={2.5} />
                ) : (
                  on && <Check className="size-4" strokeWidth={3} />
                )}
              </span>
              <CategoryIcon category={e.category} size={32} />
              <span className="min-w-0 flex-1">
                <span
                  className={cx("block truncate text-sm font-medium", !on && "text-muted line-through decoration-1")}
                >
                  {e.title}
                </span>
                <span className="block truncate text-xs text-muted">{hint}</span>
              </span>
              <span className={cx("tabular shrink-0 text-sm", on ? "font-medium" : "text-muted")}>
                {formatVND(share)}
              </span>
            </label>
          );
        })}
      </div>

      <div className="sticky bottom-0 -mx-5 border-t border-line bg-surface px-5 pb-1 pt-3">
        <div className="mb-3 flex items-center gap-3">
          <Avatar name={name} hue={memberHue(data.members, memberId)} size={36} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-muted">
              {name} trả {paying}/{expenses.length} khoản · {due < -0.004 ? "nhận lại" : "cần đóng"}
            </p>
            <p className="tabular text-xl font-bold leading-tight tracking-tight">{formatVND(Math.abs(due))}</p>
          </div>
          {Math.abs(delta) > 0.004 && (
            <span
              className={cx(
                "tabular shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                delta < 0 ? "bg-good-soft text-good" : "bg-danger-soft text-danger",
              )}
            >
              {delta > 0 ? "+" : "−"}
              {formatVND(Math.abs(delta))}
            </span>
          )}
        </div>
        <Button variant="primary" size="lg" className="w-full" onClick={save}>
          {changed.length ? `Lưu (${changed.length} khoản thay đổi)` : "Xong"}
        </Button>
      </div>
    </div>
  );
}
