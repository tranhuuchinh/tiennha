"use client";

import { Check, Minus, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { Actions } from "@/lib/client";
import { amountToInput, formatVND, parseAmount } from "@/lib/format";
import { CATEGORIES, type AppData, type CategoryKey, type Expense, type ExpenseInput } from "@/lib/types";
import { Avatar, Button, CATEGORY_ICON, categoryColor, cx, memberHue, Segmented, toast } from "./ui";

export type EditorState = { key: number; expense?: Expense; category?: CategoryKey };

const defaultTitle = (c: CategoryKey) => CATEGORIES.find((x) => x.key === c)?.defaultTitle ?? "";
const STABLE_AMOUNT: CategoryKey[] = ["nha", "phiql", "xe"];

/** Khoản gần nhất cùng loại ở tháng trước, dùng làm mẫu khi thêm mới */
function findTemplate(data: AppData, month: string, category: CategoryKey) {
  return data.expenses
    .filter((e) => e.category === category && e.month < month && e.amount > 0)
    .sort((a, b) => b.month.localeCompare(a.month) || b.createdAt.localeCompare(a.createdAt))[0];
}

type FormState = {
  category: CategoryKey;
  title: string;
  amount: string;
  negative: boolean;
  mode: "equal" | "custom";
  members: string[];
  shares: Record<string, string>;
  paidBy: string | null;
  note: string;
};

function initialState(data: AppData, month: string, editor: EditorState): FormState {
  const active = data.members.filter((m) => m.active).map((m) => m.id);
  const e = editor.expense;
  if (e) {
    const negative = e.amount < 0;
    return {
      category: e.category,
      title: e.title,
      amount: amountToInput(Math.abs(e.amount)),
      negative,
      mode: e.split.mode,
      members: e.split.mode === "equal" ? e.split.members : active,
      shares:
        e.split.mode === "custom"
          ? Object.fromEntries(Object.entries(e.split.shares).map(([id, v]) => [id, amountToInput(Math.abs(v))]))
          : {},
      paidBy: e.paidBy,
      note: e.note,
    };
  }
  return applyTemplate(data, month, {
    category: editor.category ?? "khac",
    title: "",
    amount: "",
    negative: false,
    mode: "equal",
    members: active,
    shares: {},
    paidBy: null,
    note: "",
  });
}

function applyTemplate(data: AppData, month: string, s: FormState): FormState {
  const t = findTemplate(data, month, s.category);
  const next: FormState = { ...s, title: defaultTitle(s.category) };
  if (!t || s.category === "khac") return next;
  next.title = t.title || next.title;
  next.mode = t.split.mode;
  if (t.split.mode === "equal") {
    next.members = t.split.members.filter((id) => data.members.some((m) => m.id === id && m.active));
    if (STABLE_AMOUNT.includes(s.category)) next.amount = amountToInput(t.amount);
  } else {
    next.shares = Object.fromEntries(Object.entries(t.split.shares).map(([id, v]) => [id, amountToInput(v)]));
  }
  return next;
}

export function ExpenseForm({
  data,
  month,
  editor,
  actions,
  onDone,
}: {
  data: AppData;
  month: string;
  editor: EditorState;
  actions: Actions;
  onDone: () => void;
}) {
  const [s, setS] = useState(() => initialState(data, month, editor));
  const [armDelete, setArmDelete] = useState(false);
  const [touched, setTouched] = useState(false);
  const set = (patch: Partial<FormState>) => setS((prev) => ({ ...prev, ...patch }));
  const editing = editor.expense;

  const people = data.members.filter(
    (m) => m.active || s.members.includes(m.id) || s.shares[m.id] !== undefined || s.paidBy === m.id,
  );
  const hue = (id: string) => memberHue(data.members, id);
  const skipped = people.filter((m) => !s.members.includes(m.id));

  const sign = s.negative ? -1 : 1;
  const amount = parseAmount(s.amount);
  const customTotal = Object.values(s.shares).reduce((a, v) => a + (parseAmount(v) || 0), 0);
  const total = s.mode === "equal" ? (Number.isFinite(amount) ? amount : 0) : customTotal;
  const perHead = s.mode === "equal" && s.members.length ? total / s.members.length : 0;

  const errors = {
    amount: s.mode === "equal" && !(amount > 0) ? "Nhập số tiền" : null,
    members: s.mode === "equal" && !s.members.length ? "Chọn ít nhất 1 người" : null,
    shares: s.mode === "custom" && !(customTotal > 0) ? "Nhập số tiền cho từng người" : null,
  };
  const valid = !errors.amount && !errors.members && !errors.shares;

  function pickCategory(category: CategoryKey) {
    if (category === s.category) return;
    if (editing) return set({ category });
    const untouchedTitle =
      !s.title || s.title === defaultTitle(s.category) || s.title === findTemplate(data, month, s.category)?.title;
    const next = applyTemplate(data, month, { ...s, category, amount: "", shares: {} });
    setS(untouchedTitle ? next : { ...next, title: s.title });
  }

  async function save() {
    setTouched(true);
    if (!valid) return;
    const input: ExpenseInput = {
      month,
      category: s.category,
      title: s.title.trim() || defaultTitle(s.category) || "Khoản chi",
      amount: sign * total,
      paidBy: s.paidBy,
      split:
        s.mode === "equal"
          ? { mode: "equal", members: data.members.map((m) => m.id).filter((id) => s.members.includes(id)) }
          : {
              mode: "custom",
              shares: Object.fromEntries(
                Object.entries(s.shares)
                  .map(([id, v]) => [id, sign * parseAmount(v)] as const)
                  .filter(([, v]) => Number.isFinite(v) && v !== 0),
              ),
            },
      note: s.note.trim(),
    };
    onDone();
    const ok = editing ? await actions.updateExpense(editing.id, input) : await actions.createExpenses([input]);
    if (ok) toast(editing ? "Đã cập nhật" : "Đã thêm khoản chi");
  }

  async function remove() {
    if (!editing) return;
    if (!armDelete) {
      setArmDelete(true);
      setTimeout(() => setArmDelete(false), 3000);
      return;
    }
    onDone();
    if (await actions.deleteExpense(editing.id)) toast("Đã xoá");
  }

  return (
    <form
      id="expense-form"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-5 pt-1"
    >
      {/* Loại */}
      <div className="grid grid-cols-3 gap-2">
        {CATEGORIES.map((c) => {
          const Icon = CATEGORY_ICON[c.key];
          const on = s.category === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => pickCategory(c.key)}
              aria-pressed={on}
              className={cx(
                "flex h-12 items-center gap-2 rounded-2xl px-3 text-sm font-medium ring-1 transition active:scale-[0.97]",
                on ? "bg-surface ring-2" : "bg-surface-2 text-ink-2 ring-transparent hover:text-ink",
              )}
              style={on ? { boxShadow: `inset 0 0 0 2px ${categoryColor(c.key)}`, color: "var(--ink)" } : undefined}
            >
              <Icon className="size-[18px] shrink-0" style={{ color: categoryColor(c.key) }} strokeWidth={2.2} />
              {c.label}
            </button>
          );
        })}
      </div>

      <Field label="Tên khoản">
        <input
          value={s.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder={s.category === "khac" ? "Wifi, nước giặt, dọn nhà…" : defaultTitle(s.category)}
          className="input"
          maxLength={120}
        />
      </Field>

      {/* Cách chia */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="label">Chia tiền</span>
          <Segmented
            value={s.mode}
            onChange={(mode) => {
              if (mode === "custom" && !Object.keys(s.shares).length && perHead) {
                const each = amountToInput(perHead);
                set({ mode, shares: Object.fromEntries(s.members.map((id) => [id, each])) });
              } else set({ mode });
            }}
            options={[
              { value: "equal", label: "Chia đều" },
              { value: "custom", label: "Chia riêng" },
            ]}
            className="w-56"
          />
        </div>

        {s.mode === "equal" ? (
          <>
            <Field label="Số tiền" error={touched ? errors.amount : null} hideLabel>
              <AmountInput
                value={s.amount}
                onChange={(amount) => set({ amount })}
                negative={s.negative}
                autoFocus={!editing}
              />
            </Field>
            <div className="space-y-2">
              <span className="label">Ai phải trả khoản này?</span>
              <div className="flex flex-wrap gap-2">
                {people.map((m) => {
                  const on = s.members.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={on}
                      aria-label={on ? `${m.name}: có trả, bấm để bỏ qua` : `${m.name}: bỏ qua, bấm để tính lại`}
                      onClick={() => set({ members: on ? s.members.filter((x) => x !== m.id) : [...s.members, m.id] })}
                      className={cx(
                        "flex h-10 items-center gap-2 rounded-full pl-1 pr-3.5 text-sm font-medium ring-1 transition active:scale-[0.97]",
                        on ? "bg-primary text-primary-ink ring-transparent" : "bg-surface text-muted ring-line-strong",
                      )}
                    >
                      <span className={cx("transition", !on && "opacity-40 grayscale")}>
                        <Avatar name={m.name} hue={hue(m.id)} size={30} />
                      </span>
                      <span className={cx(!on && "line-through decoration-1")}>{m.name}</span>
                      {on ? (
                        <Check className="size-3.5" strokeWidth={3} />
                      ) : (
                        <X className="size-3.5" strokeWidth={2.5} />
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-[13px] text-muted">
                {skipped.length && s.members.length
                  ? `Bỏ qua ${skipped.map((m) => m.name).join(", ")}: phần này chia cho ${s.members.length} người còn lại.`
                  : "Bấm vào tên để bỏ qua người không cần trả khoản này."}
              </p>
            </div>
            {touched && errors.members && <p className="text-sm text-danger">{errors.members}</p>}
          </>
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-2xl ring-1 ring-line">
            {people.map((m) => (
              <label key={m.id} className="flex items-center gap-3 bg-surface px-3 py-2">
                <Avatar name={m.name} hue={hue(m.id)} size={30} />
                <span className="flex-1 text-sm font-medium">{m.name}</span>
                <span className="relative w-36">
                  <input
                    inputMode="decimal"
                    value={s.shares[m.id] ?? ""}
                    onChange={(e) => set({ shares: { ...s.shares, [m.id]: e.target.value } })}
                    placeholder="0"
                    className="tabular h-10 w-full rounded-xl bg-surface-2 pl-3 pr-7 text-right font-medium outline-none ring-ink/20 transition focus:ring-2"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                    k
                  </span>
                </span>
              </label>
            ))}
            {touched && errors.shares && <p className="px-3 py-2 text-sm text-danger">{errors.shares}</p>}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-sm">
          <div>
            <div className="text-muted">Tổng</div>
            <div className="tabular text-base font-semibold">{formatVND(sign * total)}</div>
          </div>
          {s.mode === "equal" && s.members.length > 0 && (
            <div className="text-right">
              <div className="text-muted">Mỗi người ({s.members.length})</div>
              <div className="tabular text-base font-semibold">{formatVND(sign * perHead)}</div>
            </div>
          )}
          <button
            type="button"
            onClick={() => set({ negative: !s.negative })}
            aria-pressed={s.negative}
            className={cx(
              "flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium ring-1 transition",
              s.negative ? "bg-danger-soft text-danger ring-transparent" : "text-ink-2 ring-line-strong hover:text-ink",
            )}
          >
            <Minus className="size-3.5" strokeWidth={3} />
            Giảm trừ
          </button>
        </div>
      </div>

      {/* Ai ứng */}
      <div className="space-y-2">
        <span className="label">Ai đã trả tiền trước?</span>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          <PayerChip on={s.paidBy === null} onClick={() => set({ paidBy: null })}>
            Chưa ai / quỹ chung
          </PayerChip>
          {people.map((m) => (
            <PayerChip key={m.id} on={s.paidBy === m.id} onClick={() => set({ paidBy: m.id })}>
              <Avatar name={m.name} hue={hue(m.id)} size={24} />
              {m.name}
            </PayerChip>
          ))}
        </div>
        <p className="text-[13px] text-muted">
          {s.paidBy
            ? `${data.members.find((m) => m.id === s.paidBy)?.name} sẽ được trừ ${formatVND(Math.abs(total))} khi đóng tiền tháng này.`
            : "Chọn người đã bỏ tiền túi ra trả, họ sẽ được trừ lại khi đóng tiền."}
        </p>
      </div>

      <Field label="Ghi chú">
        <input
          value={s.note}
          onChange={(e) => set({ note: e.target.value })}
          placeholder="Không bắt buộc"
          className="input"
          maxLength={300}
        />
      </Field>

      <div className="flex gap-2 pt-1">
        {editing && (
          <Button variant="danger" size="lg" onClick={remove} className="shrink-0">
            <Trash2 className="size-4" />
            {armDelete ? "Chắc chắn xoá?" : "Xoá"}
          </Button>
        )}
        <Button type="submit" variant="primary" size="lg" className="flex-1">
          {editing ? "Lưu thay đổi" : "Thêm khoản chi"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  hideLabel,
  children,
}: {
  label: string;
  error?: string | null;
  hideLabel?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className={hideLabel ? "sr-only" : "label"}>{label}</span>
      {children}
      {error && <span className="block text-sm text-danger">{error}</span>}
    </label>
  );
}

function AmountInput({
  value,
  onChange,
  negative,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  negative: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="relative">
      {negative && (
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-3xl font-semibold text-danger">
          −
        </span>
      )}
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
        placeholder="0"
        autoFocus={autoFocus}
        className={cx(
          "tabular h-16 w-full rounded-2xl bg-surface-2 pr-24 text-3xl font-semibold tracking-tight outline-none ring-ink/20 transition placeholder:text-muted/60 focus:ring-2",
          negative ? "pl-10 text-danger" : "pl-4",
        )}
      />
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-right text-sm leading-tight text-muted">
        nghìn đồng
        <br />
        <span className="font-semibold text-ink-2">(k)</span>
      </span>
    </div>
  );
}

function PayerChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cx(
        "flex h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-medium ring-1 transition active:scale-[0.97]",
        on ? "bg-primary text-primary-ink ring-transparent" : "bg-surface text-ink-2 ring-line-strong",
        "has-[span]:pl-1.5",
      )}
    >
      {children}
    </button>
  );
}
