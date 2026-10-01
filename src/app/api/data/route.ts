import { handle } from "@/lib/server/api";

export async function GET() {
  return handle(async (store) => ({ ...(await store.load()), storage: store.kind }));
}
