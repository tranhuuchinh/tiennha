import { connection } from "next/server";
import { App } from "@/components/app";
import { Login } from "@/components/login";
import { isAuthed, passcodeEnabled } from "@/lib/server/auth";

export default async function Page() {
  // luôn render theo request: mã truy cập đọc từ env lúc chạy, không phải lúc build
  await connection();
  if (!(await isAuthed())) return <Login />;
  return <App canLogout={passcodeEnabled()} />;
}
