import { handle, parseExpenseInput, readJson } from "@/lib/server/api";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async (store) => {
    const { id } = await ctx.params;
    const expense = await store.updateExpense(id, parseExpenseInput(await readJson(req)));
    return { expense };
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async (store) => {
    const { id } = await ctx.params;
    await store.deleteExpense(id);
  });
}
