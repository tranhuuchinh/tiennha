"use client";

import { LogOut, Plus } from "lucide-react";
import { useState } from "react";
import type { Actions } from "@/lib/client";
import type { Member } from "@/lib/types";
import { Avatar, Button, cx, memberHue, toast } from "./ui";

function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
}

export function MembersForm({
  members,
  actions,
  onDone,
  canLogout,
  storage,
}: {
  members: Member[];
  actions: Actions;
  onDone: () => void;
  canLogout: boolean;
  storage: "sheets" | "file";
}) {
  const [list, setList] = useState<(Member & { isNew?: boolean })[]>(members);
  const update = (i: number, patch: Partial<Member>) => setList(list.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  async function save() {
    const used = new Set<string>();
    const result: Member[] = [];
    for (const m of list) {
      const name = m.name.trim();
      if (!name) continue;
      let id = m.isNew ? slugify(name) || "nguoi" : m.id;
      if (m.isNew) {
        const base = id;
        for (let n = 2; used.has(id) || members.some((x) => x.id === id); n++) id = `${base}${n}`;
      }
      used.add(id);
      result.push({ id, name, active: m.active });
    }
    onDone();
    if (await actions.saveMembers(result)) toast("Đã lưu thành viên");
  }

  async function logout() {
    await fetch("/api/login", { method: "DELETE" });
    window.location.reload();
  }

  return (
    <div className="space-y-4 pt-1">
      <p className="text-sm text-ink-2">
        Người <b>đang ở</b> sẽ được chọn sẵn khi thêm khoản chi mới. Người đã chuyển đi vẫn giữ nguyên trong các tháng
        cũ.
      </p>
      <div className="divide-y divide-line overflow-hidden rounded-2xl ring-1 ring-line">
        {list.map((m, i) => (
          <div key={m.isNew ? `new-${i}` : m.id} className="flex items-center gap-3 bg-surface px-3 py-2">
            <Avatar name={m.name || "?"} hue={memberHue(list, m.id)} size={34} />
            <input
              value={m.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="Tên"
              className="input h-10 min-w-0 flex-1"
              maxLength={40}
            />
            <button
              type="button"
              onClick={() => update(i, { active: !m.active })}
              aria-pressed={m.active}
              className={cx(
                "h-9 shrink-0 rounded-full px-3 text-[13px] font-semibold ring-1 transition",
                m.active ? "bg-good-soft text-good ring-transparent" : "text-muted ring-line-strong",
              )}
            >
              {m.active ? "Đang ở" : "Đã chuyển"}
            </button>
          </div>
        ))}
      </div>
      <Button
        variant="ghost"
        onClick={() => setList([...list, { id: `new${list.length}`, name: "", active: true, isNew: true }])}
      >
        <Plus className="size-4" /> Thêm người
      </Button>
      <Button variant="primary" size="lg" className="w-full" onClick={save}>
        Lưu
      </Button>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-4 text-[13px] text-muted">
        <span>{storage === "sheets" ? "Dữ liệu lưu trên Google Sheets" : "Đang chạy với dữ liệu thử trên máy"}</span>
        {canLogout && (
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="size-4" /> Đăng xuất
          </Button>
        )}
      </div>
    </div>
  );
}
