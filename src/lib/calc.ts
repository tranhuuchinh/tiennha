import { CATEGORIES, type AppData, type CategoryKey, type Expense, type Member } from "./types";

export function sharesOf(e: Expense): Record<string, number> {
  if (e.split.mode === "custom") return { ...e.split.shares };
  const ids = e.split.members;
  if (ids.length === 0) return {};
  const each = e.amount / ids.length;
  return Object.fromEntries(ids.map((id) => [id, each]));
}

export function splitTotal(e: Pick<Expense, "amount" | "split">) {
  if (e.split.mode === "equal") return e.amount;
  return Object.values(e.split.shares).reduce((a, b) => a + b, 0);
}

export function emptyByCategory(): Record<CategoryKey, number> {
  return Object.fromEntries(CATEGORIES.map((c) => [c.key, 0])) as Record<CategoryKey, number>;
}

export type MemberSummary = {
  member: Member;
  byCategory: Record<CategoryKey, number>;
  total: number; // tổng phần phải chịu
  advanced: number; // đã ứng trước
  due: number; // còn phải đóng = total - advanced
  paid: boolean;
  items: { expense: Expense; share: number }[];
};

export type MonthSummary = {
  month: string;
  expenses: Expense[];
  byCategory: Record<CategoryKey, number>;
  total: number;
  people: MemberSummary[];
};

export function summarizeMonth(data: AppData, month: string): MonthSummary {
  const expenses = data.expenses
    .filter((e) => e.month === month)
    .sort((a, b) => catIndex(a.category) - catIndex(b.category) || a.createdAt.localeCompare(b.createdAt));
  const meta = data.months.find((m) => m.month === month);
  const paid = new Set(meta?.paid ?? []);

  const involved = new Set<string>();
  for (const e of expenses) {
    for (const id of Object.keys(sharesOf(e))) involved.add(id);
    if (e.paidBy) involved.add(e.paidBy);
  }
  const members = data.members.filter((m) => involved.has(m.id) || (expenses.length === 0 && m.active));
  // Người có trong khoản chi nhưng đã bị xoá khỏi danh sách thành viên
  for (const id of involved) {
    if (!members.some((m) => m.id === id)) members.push({ id, name: id, active: false });
  }

  const people: MemberSummary[] = members.map((member) => ({
    member,
    byCategory: emptyByCategory(),
    total: 0,
    advanced: 0,
    due: 0,
    paid: paid.has(member.id),
    items: [],
  }));
  const byId = new Map(people.map((p) => [p.member.id, p]));
  const byCategory = emptyByCategory();
  let total = 0;

  for (const e of expenses) {
    const amount = splitTotal(e);
    byCategory[e.category] += amount;
    total += amount;
    for (const [id, share] of Object.entries(sharesOf(e))) {
      const p = byId.get(id);
      if (!p) continue;
      p.byCategory[e.category] += share;
      p.total += share;
      p.items.push({ expense: e, share });
    }
    if (e.paidBy) {
      const p = byId.get(e.paidBy);
      if (p) p.advanced += amount;
    }
  }
  for (const p of people) p.due = p.total - p.advanced;

  return { month, expenses, byCategory, total, people };
}

function catIndex(key: CategoryKey) {
  return CATEGORIES.findIndex((c) => c.key === key);
}

export function allMonths(data: AppData): string[] {
  const set = new Set<string>();
  for (const e of data.expenses) set.add(e.month);
  for (const m of data.months) set.add(m.month);
  return [...set].sort();
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
