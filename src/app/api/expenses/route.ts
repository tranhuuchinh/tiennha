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
