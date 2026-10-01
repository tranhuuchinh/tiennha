/**
 * Ghi đè các tab members / expenses / months trên Google Sheet bằng dữ liệu từ file JSON.
 * Không đụng tới các tab khác (vd. "Trang tính1").
 *
 *   npm run sheet:push -- .data/seed.json
 */
import { readFileSync } from "node:fs";
import { getStore } from "../src/lib/server/store";
import type { AppData } from "../src/lib/types";

const file = process.argv[2];
if (!file) {
  console.error("Cách dùng: npm run sheet:push -- <file.json>");
  process.exit(1);
}

async function main() {
  const data = JSON.parse(readFileSync(file, "utf8")) as AppData;
  const store = getStore();
  if (store.kind !== "sheets") {
    console.error("Chưa cấu hình Google Sheets (GOOGLE_SHEET_ID + service account) trong .env.local");
    process.exit(1);
  }

  await store.replaceAll(data);
  const check = await store.load();
  console.log(
    `Đã ghi ${check.members.length} thành viên, ${check.expenses.length} khoản chi, ${check.months.length} tháng lên Google Sheet.`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
