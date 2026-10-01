import { CATEGORIES, type CategoryKey, type ExpenseInput, type Member, type Split } from "../types";
import { isAuthed } from "./auth";
import { SheetsError } from "./google";
import { getStore, NotConfiguredError, type Store } from "./store";

export class BadRequest extends Error {}

export async function handle(fn: (store: Store) => Promise<unknown>) {
  try {
    if (!(await isAuthed())) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
    const result = await fn(getStore());
    return Response.json(result ?? { ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi không xác định";
    const status =
      err instanceof BadRequest
        ? 400
        : err instanceof NotConfiguredError
          ? 503
          : err instanceof SheetsError
            ? 502
            : 500;
    if (status >= 500) console.error(err);
    return Response.json({ error: message }, { status });
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object") return body as Record<string, unknown>;
  } catch {}
  throw new BadRequest("Dữ liệu gửi lên không hợp lệ");
}

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function parseMonth(value: unknown) {
  if (typeof value !== "string" || !MONTH_RE.test(value)) throw new BadRequest("Tháng không hợp lệ");
  return value;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const text = (v: unknown, max = 300) => (typeof v === "string" ? v.slice(0, max) : "");

export function parseExpenseInput(body: Record<string, unknown>): ExpenseInput {
  const category = body.category as CategoryKey;
  if (!CATEGORIES.some((c) => c.key === category)) throw new BadRequest("Loại khoản chi không hợp lệ");

  const rawSplit = body.split as Split | undefined;
  let split: Split;
  if (rawSplit?.mode === "equal" && Array.isArray(rawSplit.members)) {
    split = { mode: "equal", members: rawSplit.members.filter((m): m is string => typeof m === "string") };
    if (!split.members.length) throw new BadRequest("Chọn ít nhất 1 người để chia");
  } else if (rawSplit?.mode === "custom" && rawSplit.shares && typeof rawSplit.shares === "object") {
    const shares = Object.fromEntries(Object.entries(rawSplit.shares).filter(([, v]) => isNum(v) && v !== 0));
    if (!Object.keys(shares).length) throw new BadRequest("Nhập số tiền cho ít nhất 1 người");
    split = { mode: "custom", shares };
  } else {
    throw new BadRequest("Cách chia không hợp lệ");
  }

  if (split.mode === "equal" && (!isNum(body.amount) || body.amount === 0)) {
    throw new BadRequest("Số tiền không hợp lệ");
  }

  return {
    month: parseMonth(body.month),
    category,
    title: text(body.title, 120),
    amount: isNum(body.amount) ? body.amount : 0,
    paidBy: typeof body.paidBy === "string" && body.paidBy ? body.paidBy : null,
    split,
    note: text(body.note),
  };
}

export function parseMembers(value: unknown): Member[] {
  if (!Array.isArray(value)) throw new BadRequest("Danh sách thành viên không hợp lệ");
  const members = value
    .map((m) => ({
      id: text(m?.id, 40).trim(),
      name: text(m?.name, 40).trim(),
      active: m?.active !== false,
    }))
    .filter((m) => m.id && m.name);
  if (new Set(members.map((m) => m.id)).size !== members.length) throw new BadRequest("ID thành viên bị trùng");
  return members;
}
