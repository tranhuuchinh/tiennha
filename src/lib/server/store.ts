import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  categoryFromLabel,
  categoryLabel,
  type AppData,
  type Expense,
  type ExpenseInput,
  type Member,
  type MonthMeta,
  type Split,
} from "../types";
import { readGoogleCreds, SheetsClient, type CellValue } from "./google";

export interface Store {
  kind: "sheets" | "file";
  load(): Promise<AppData>;
  createExpenses(inputs: ExpenseInput[]): Promise<Expense[]>;
  updateExpense(id: string, input: ExpenseInput): Promise<Expense>;
  deleteExpense(id: string): Promise<void>;
  saveMonth(meta: Omit<MonthMeta, "updatedAt">): Promise<MonthMeta>;
  saveMembers(members: Member[]): Promise<Member[]>;
  replaceAll(data: AppData): Promise<void>;
}

export class NotConfiguredError extends Error {}

export function getStore(): Store {
  // DATA_STORE=file: chạy thử trên máy bằng .data/db.json, không đụng sheet thật
  if (process.env.DATA_STORE === "file" && process.env.NODE_ENV !== "production") return fileStore;
  const creds = readGoogleCreds();
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (creds && sheetId) return new SheetsStore(new SheetsClient(sheetId, creds));
  if (process.env.NODE_ENV !== "production") return fileStore;
  throw new NotConfiguredError(
    "Chưa cấu hình Google Sheets: cần GOOGLE_SHEET_ID và GOOGLE_SERVICE_ACCOUNT_JSON trên Vercel.",
  );
}

const newId = () => randomUUID().replace(/-/g, "").slice(0, 10);
const now = () => new Date().toISOString();

function buildExpense(input: ExpenseInput, id = newId(), createdAt = now()): Expense {
  const split = normalizeSplit(input.split);
  const amount =
    split.mode === "custom" ? Object.values(split.shares).reduce((a, b) => a + b, 0) : Number(input.amount) || 0;
  return {
    id,
    month: input.month,
    category: input.category,
    title: input.title.trim(),
    amount: round2(amount),
    paidBy: input.paidBy || null,
    split,
    note: input.note.trim(),
    createdAt,
    updatedAt: now(),
  };
}

function normalizeSplit(split: Split): Split {
  if (split.mode === "custom") {
    const shares: Record<string, number> = {};
    for (const [id, v] of Object.entries(split.shares)) {
      const n = round2(Number(v));
      if (Number.isFinite(n) && n !== 0) shares[id] = n;
    }
    return { mode: "custom", shares };
  }
  return { mode: "equal", members: [...new Set(split.members)] };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Chạy lần lượt các thao tác ghi trong cùng một instance để tránh ghi đè lẫn nhau */
function createQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => {});
    return run;
  };
}

/* ---------------------------- Google Sheets ---------------------------- */

const TABS = {
  members: { title: "members", headers: ["ID", "Tên", "Đang ở"] },
  expenses: {
    title: "expenses",
    headers: [
      "ID",
      "Tháng",
      "Loại",
      "Tên khoản",
      "Số tiền (k)",
      "Người ứng",
      "Cách chia",
      "Chia cho",
      "Ghi chú",
      "Tạo lúc",
      "Sửa lúc",
    ],
  },
  months: { title: "months", headers: ["Tháng", "Ghi chú", "Đã đóng", "Sửa lúc"] },
} as const;

type TabKey = keyof typeof TABS;

const str = (v: CellValue | undefined) => (v === undefined || v === null ? "" : String(v).trim());
const num = (v: CellValue | undefined) => {
  if (typeof v === "number") return v;
  const n = Number(str(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const list = (v: CellValue | undefined) =>
  str(v)
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);

function normalizeMonth(v: CellValue | undefined): string {
  if (typeof v === "number") {
    // ngày dạng serial của Google Sheets
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86_400_000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  const s = str(v);
  const vn = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (vn) return `${vn[2]}-${vn[1].padStart(2, "0")}`;
  const iso = s.match(/^(\d{4})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}`;
  return s;
}

function splitToCells(split: Split): [string, string] {
  if (split.mode === "equal") return ["đều", split.members.join(", ")];
  return [
    "riêng",
    Object.entries(split.shares)
      .map(([id, v]) => `${id}: ${v}`)
      .join(", "),
  ];
}

function splitFromCells(mode: CellValue | undefined, value: CellValue | undefined): Split {
  const m = str(mode).toLowerCase();
  if (m === "riêng" || m === "rieng" || m === "custom") {
    const shares: Record<string, number> = {};
    for (const part of str(value).split(/[,;]/)) {
      const [id, v] = part.split(":").map((s) => s.trim());
      if (id && v) shares[id] = num(v);
    }
    return { mode: "custom", shares };
  }
  return { mode: "equal", members: list(value) };
}

function expenseToRow(e: Expense): CellValue[] {
  return [
    e.id,
    e.month,
    categoryLabel(e.category),
    e.title,
    e.amount,
    e.paidBy ?? "",
    ...splitToCells(e.split),
    e.note,
    e.createdAt,
    e.updatedAt,
  ];
}

function rowToExpense(r: CellValue[]): Expense {
  return {
    id: str(r[0]),
    month: normalizeMonth(r[1]),
    category: categoryFromLabel(r[2]),
    title: str(r[3]),
    amount: num(r[4]),
    paidBy: str(r[5]) || null,
    split: splitFromCells(r[6], r[7]),
    note: str(r[8]),
    createdAt: str(r[9]),
    updatedAt: str(r[10]),
  };
}

const memberToRow = (m: Member): CellValue[] => [m.id, m.name, m.active];
const rowToMember = (r: CellValue[]): Member => {
  const active = str(r[2]).toLowerCase();
  return {
    id: str(r[0]),
    name: str(r[1]) || str(r[0]),
    active: !["false", "0", "không", "khong", "no"].includes(active),
  };
};

const monthToRow = (m: MonthMeta): CellValue[] => [m.month, m.note, m.paid.join(", "), m.updatedAt];
const rowToMonth = (r: CellValue[]): MonthMeta => ({
  month: normalizeMonth(r[0]),
  note: str(r[1]),
  paid: list(r[2]),
  updatedAt: str(r[3]),
});

let tabsReady: Promise<Map<string, number>> | null = null;

const sheetsQueue = createQueue();

class SheetsStore implements Store {
  kind = "sheets" as const;
  private queue = sheetsQueue;
  constructor(private client: SheetsClient) {}

  /** Tạo các tab members / expenses / months nếu chưa có. Không đụng tới tab khác. */
  private ensureTabs() {
    tabsReady ??= (async () => {
      const { sheets } = await this.client.sheetProperties();
      const ids = new Map(sheets.map((s) => [s.properties.title, s.properties.sheetId]));
      const missing = (Object.keys(TABS) as TabKey[]).filter((k) => !ids.has(TABS[k].title));
      if (missing.length) {
        const res = await this.client.batchUpdate(
          missing.map((k) => ({
            addSheet: { properties: { title: TABS[k].title, gridProperties: { frozenRowCount: 1 } } },
          })),
        );
        for (const reply of res.replies) {
          if (reply.addSheet) ids.set(reply.addSheet.properties.title, reply.addSheet.properties.sheetId);
        }
        for (const k of missing) await this.client.update(`${TABS[k].title}!A1`, [[...TABS[k].headers]]);
        await this.client.batchUpdate(
          missing.map((k) => ({
            repeatCell: {
              range: { sheetId: ids.get(TABS[k].title), startRowIndex: 0, endRowIndex: 1 },
              cell: { userEnteredFormat: { textFormat: { bold: true } } },
              fields: "userEnteredFormat.textFormat.bold",
            },
          })),
        );
      }
      return ids;
    })().catch((err) => {
      tabsReady = null;
      throw err;
    });
    return tabsReady;
  }

  async load(): Promise<AppData> {
    await this.ensureTabs();
    const [members, expenses, months] = await this.client.batchGet([
      `${TABS.members.title}!A2:C`,
      `${TABS.expenses.title}!A2:K`,
      `${TABS.months.title}!A2:D`,
    ]);
    return {
      members: members.filter((r) => str(r[0])).map(rowToMember),
      expenses: expenses.filter((r) => str(r[0])).map(rowToExpense),
      // nếu lỡ có 2 dòng cùng tháng thì lấy dòng sau cùng
      months: [...new Map(months.filter((r) => str(r[0])).map((r) => [normalizeMonth(r[0]), rowToMonth(r)])).values()],
    };
  }

  /** Số dòng (1-based) có cột A bằng key, hoặc -1 */
  private async findRow(tab: TabKey, key: string, normalize: (v: CellValue) => string = str) {
    const col = await this.client.get(`${TABS[tab].title}!A:A`);
    const idx = col.findIndex((r, i) => i > 0 && normalize(r[0]) === key);
    return idx === -1 ? -1 : idx + 1;
  }

  createExpenses(inputs: ExpenseInput[]) {
    return this.queue(async () => {
      await this.ensureTabs();
      const created = inputs.map((i) => buildExpense(i));
      if (created.length) await this.client.append(`${TABS.expenses.title}!A:K`, created.map(expenseToRow));
      return created;
    });
  }

  /** Đọc lại dòng ngay trước khi ghi để chắc chắn vẫn đúng khoản chi (phòng khi dòng bị xê dịch) */
  private async locateExpense(id: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const row = await this.findRow("expenses", id);
      if (row === -1) return null;
      const [current] = await this.client.get(`${TABS.expenses.title}!A${row}:K${row}`);
      if (str(current?.[0]) === id) return { row, current };
    }
    throw new Error("Sheet đang thay đổi liên tục, thử lại sau giây lát.");
  }

  updateExpense(id: string, input: ExpenseInput) {
    return this.queue(async () => {
      await this.ensureTabs();
      const found = await this.locateExpense(id);
      if (!found) throw new Error("Khoản chi không còn tồn tại (có thể ai đó vừa xoá).");
      const expense = buildExpense(input, id, str(found.current[9]) || now());
      await this.client.update(`${TABS.expenses.title}!A${found.row}:K${found.row}`, [expenseToRow(expense)]);
      return expense;
    });
  }

  deleteExpense(id: string) {
    return this.queue(async () => {
      const ids = await this.ensureTabs();
      const found = await this.locateExpense(id);
      if (!found) return;
      await this.client.batchUpdate([
        {
          deleteDimension: {
            range: {
              sheetId: ids.get(TABS.expenses.title),
              dimension: "ROWS",
              startIndex: found.row - 1,
              endIndex: found.row,
            },
          },
        },
      ]);
    });
  }

  saveMonth(input: Omit<MonthMeta, "updatedAt">) {
    return this.queue(async () => {
      await this.ensureTabs();
      const meta: MonthMeta = { ...input, updatedAt: now() };
      const row = await this.findRow("months", meta.month, normalizeMonth);
      if (row === -1) await this.client.append(`${TABS.months.title}!A:D`, [monthToRow(meta)]);
      else await this.client.update(`${TABS.months.title}!A${row}:D${row}`, [monthToRow(meta)]);
      return meta;
    });
  }

  saveMembers(members: Member[]) {
    return this.queue(async () => {
      await this.ensureTabs();
      await this.client.clear(`${TABS.members.title}!A2:C`);
      if (members.length) await this.client.update(`${TABS.members.title}!A2`, members.map(memberToRow));
      return members;
    });
  }

  async replaceAll(data: AppData) {
    await this.ensureTabs();
    await this.client.clear(`${TABS.members.title}!A2:C`);
    await this.client.clear(`${TABS.expenses.title}!A2:K`);
    await this.client.clear(`${TABS.months.title}!A2:D`);
    if (data.members.length) await this.client.update(`${TABS.members.title}!A2`, data.members.map(memberToRow));
    if (data.expenses.length) await this.client.update(`${TABS.expenses.title}!A2`, data.expenses.map(expenseToRow));
    if (data.months.length) await this.client.update(`${TABS.months.title}!A2`, data.months.map(monthToRow));
  }
}

/* ------------------------- File (chỉ dùng khi dev) ------------------------- */

const DB_FILE = path.join(process.cwd(), ".data", "db.json");

class FileStore implements Store {
  kind = "file" as const;
  private queue = createQueue();

  async load(): Promise<AppData> {
    try {
      return JSON.parse(await readFile(DB_FILE, "utf8")) as AppData;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return { members: [], expenses: [], months: [] };
      throw err;
    }
  }

  /** Đọc - sửa - ghi trong hàng đợi, ghi ra file tạm rồi đổi tên để không bao giờ đọc phải file ghi dở */
  private change<T>(fn: (data: AppData) => T): Promise<T> {
    return this.queue(async () => {
      const data = await this.load();
      const result = fn(data);
      await mkdir(path.dirname(DB_FILE), { recursive: true });
      const tmp = `${DB_FILE}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(data, null, 2));
      await rename(tmp, DB_FILE);
      return result;
    });
  }

  createExpenses(inputs: ExpenseInput[]) {
    return this.change((data) => {
      const created = inputs.map((i) => buildExpense(i));
      data.expenses.push(...created);
      return created;
    });
  }

  updateExpense(id: string, input: ExpenseInput) {
    return this.change((data) => {
      const idx = data.expenses.findIndex((e) => e.id === id);
      if (idx === -1) throw new Error("Khoản chi không còn tồn tại.");
      const expense = buildExpense(input, id, data.expenses[idx].createdAt);
      data.expenses[idx] = expense;
      return expense;
    });
  }

  deleteExpense(id: string) {
    return this.change((data) => {
      data.expenses = data.expenses.filter((e) => e.id !== id);
    });
  }

  saveMonth(input: Omit<MonthMeta, "updatedAt">) {
    return this.change((data) => {
      const meta: MonthMeta = { ...input, updatedAt: now() };
      data.months = [...data.months.filter((m) => m.month !== meta.month), meta];
      return meta;
    });
  }

  saveMembers(members: Member[]) {
    return this.change((data) => {
      data.members = members;
      return members;
    });
  }

  replaceAll(next: AppData) {
    return this.change((data) => {
      Object.assign(data, next);
    });
  }
}

const fileStore = new FileStore();
