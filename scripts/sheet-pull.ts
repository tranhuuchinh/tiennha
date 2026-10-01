/**
 * Sao lưu dữ liệu từ Google Sheet ra file JSON.
 *
 *   npm run sheet:pull -- backup.json
 */
import { writeFileSync } from "node:fs";
import { getStore } from "../src/lib/server/store";

const file = process.argv[2] ?? `.data/backup-${new Date().toISOString().slice(0, 10)}.json`;
async function main() {
  const store = getStore();
  const data = await store.load();
  writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`Đã lưu ${data.expenses.length} khoản chi từ ${store.kind} vào ${file}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
