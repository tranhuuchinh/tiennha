import { BadRequest, handle, parseExpenseInput, readJson } from "@/lib/server/api";

/** Tạo 1 hoặc nhiều khoản chi: body = { expenses: ExpenseInput[] } */
export async function POST(req: Request) {
  return handle(async (store) => {
    const body = await readJson(req);
    const list = Array.isArray(body.expenses) ? body.expenses : [body];
    if (!list.length || list.length > 50) throw new BadRequest("Số khoản chi không hợp lệ");
    const created = await store.createExpenses(list.map((e) => parseExpenseInput(e as Record<string, unknown>)));
    return { expenses: created };
  });
}

/** Cập nhật nhiều khoản chi: body = { updates: (ExpenseInput & { id })[] } */
export async function PATCH(req: Request) {
  return handle(async (store) => {
    const body = await readJson(req);
    const list = Array.isArray(body.updates) ? body.updates : [];
    if (!list.length || list.length > 100) throw new BadRequest("Danh sách cập nhật không hợp lệ");
    const updates = list.map((u) => {
      const item = u as Record<string, unknown>;
      if (typeof item.id !== "string" || !item.id) throw new BadRequest("Thiếu ID khoản chi");
      return { id: item.id, input: parseExpenseInput(item) };
    });
    return { expenses: await store.updateExpenses(updates) };
  });
}
