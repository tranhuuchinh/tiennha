import { handle, parseMembers, readJson } from "@/lib/server/api";

export async function PUT(req: Request) {
  return handle(async (store) => {
    const body = await readJson(req);
    return { members: await store.saveMembers(parseMembers(body.members)) };
  });
}
