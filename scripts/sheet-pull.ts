/**
 * Sao lưu dữ liệu từ Google Sheet ra file JSON.
 *
 *   npm run sheet:pull -- backup.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getStore } from "../src/lib/server/store";

// ngày theo giờ máy (sv-SE cho ra dạng YYYY-MM-DD)
const file = process.argv[2] ?? `.data/backup-${new Date().toLocaleDateString("sv-SE")}.json`;
async function main() {
  const store = getStore();
  const data = await store.load();
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`Đã lưu ${data.expenses.length} khoản chi từ ${store.kind} vào ${file}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
