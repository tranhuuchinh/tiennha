"use client";

import { Lock } from "lucide-react";
import { useState } from "react";
import { Logo } from "./logo";
import { Button, cx } from "./ui";

export function Login() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!passcode.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    if (res.ok) {
      window.location.reload();
      return;
    }
    const body = await res.json().catch(() => ({}));
    setError(body.error ?? "Không đăng nhập được");
    setBusy(false);
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <form onSubmit={submit} className="card animate-rise w-full max-w-sm p-7 text-center">
        <Logo className="mx-auto size-14" />
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Tiền nhà</h1>
        <p className="mt-1 text-sm text-ink-2">Nhập mã truy cập chung của nhà</p>
        <div className="relative mt-6">
          <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Mã truy cập"
            className={cx("input h-12 pl-11", error && "ring-2 ring-danger")}
          />
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <Button type="submit" variant="primary" size="lg" className="mt-4 w-full" disabled={busy}>
          {busy ? "Đang kiểm tra…" : "Vào"}
        </Button>
      </form>
    </main>
  );
}
