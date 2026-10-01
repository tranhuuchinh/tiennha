import { handle, parseMonth, readJson } from "@/lib/server/api";

export async function PUT(req: Request, ctx: { params: Promise<{ month: string }> }) {
  return handle(async (store) => {
    const month = parseMonth((await ctx.params).month);
    const body = await readJson(req);
    const meta = await store.saveMonth({
      month,
      note: typeof body.note === "string" ? body.note.slice(0, 500) : "",
      paid: Array.isArray(body.paid) ? body.paid.filter((p): p is string => typeof p === "string") : [],
    });
    return { month: meta };
  });
}
