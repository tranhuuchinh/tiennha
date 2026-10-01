// Mọi số tiền được lưu theo đơn vị nghìn đồng (k), giống sheet gốc.

export const CATEGORIES = [
  { key: "nha", label: "Nhà", defaultTitle: "Tiền nhà" },
  { key: "dien", label: "Điện", defaultTitle: "Tiền điện" },
  { key: "nuoc", label: "Nước", defaultTitle: "Tiền nước" },
  { key: "phiql", label: "Phí QL", defaultTitle: "Phí quản lý" },
  { key: "xe", label: "Xe", defaultTitle: "Gửi xe" },
  { key: "khac", label: "Khác", defaultTitle: "" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

export type Member = {
  id: string;
  name: string;
  active: boolean;
};

export type Split = { mode: "equal"; members: string[] } | { mode: "custom"; shares: Record<string, number> };

export type Expense = {
  id: string;
  month: string; // YYYY-MM
  category: CategoryKey;
  title: string;
  amount: number;
  paidBy: string | null; // người ứng tiền trước, null = quỹ chung
  split: Split;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type MonthMeta = {
  month: string;
  note: string;
  paid: string[]; // id những người đã đóng
  updatedAt: string;
};

export type AppData = {
  members: Member[];
  expenses: Expense[];
  months: MonthMeta[];
};

export type ExpenseInput = Omit<Expense, "id" | "createdAt" | "updatedAt">;

export function categoryLabel(key: CategoryKey) {
  return CATEGORIES.find((c) => c.key === key)?.label ?? "Khác";
}

export function categoryFromLabel(value: unknown): CategoryKey {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  const hit = CATEGORIES.find((c) => c.key === v || c.label.toLowerCase() === v);
  return hit?.key ?? "khac";
}
