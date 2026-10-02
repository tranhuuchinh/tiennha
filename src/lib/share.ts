import type { MonthSummary } from "./calc";
import { formatK, formatMonth, formatVND } from "./format";
import { CATEGORIES } from "./types";

export function splitLabel(summary: MonthSummary, expenseId: string, memberName: (id: string) => string) {
  const e = summary.expenses.find((x) => x.id === expenseId);
  if (!e) return "";
  if (e.split.mode === "custom") return "chia riêng";
  const members = e.split.members;
  const n = members.length;
  const skipped = summary.people.filter((p) => !members.includes(p.member.id)).map((p) => p.member.name);
  if (!skipped.length) return `chia đều ${n}`;
  if (n === 1) return `riêng ${memberName(members[0])}`;
  if (skipped.length <= 2) return `chia đều ${n} · trừ ${skipped.join(", ")}`;
  return `chia ${members.map(memberName).join(", ")}`;
}

export function buildShareText(summary: MonthSummary, memberName: (id: string) => string, url?: string) {
  const lines: string[] = [];
  lines.push(`🏠 Tiền nhà tháng ${formatMonth(summary.month)}`);
  const cats = CATEGORIES.filter((c) => summary.byCategory[c.key] !== 0)
    .map((c) => `${c.label} ${formatK(summary.byCategory[c.key])}`)
    .join(" · ");
  lines.push(`Tổng chi: ${formatVND(summary.total)}${cats ? ` (${cats})` : ""}`);
  lines.push("");
  for (const p of summary.people) {
    let line = `• ${p.member.name}: ${formatVND(p.due)}`;
    if (p.advanced) line += ` (đã trừ ${formatVND(p.advanced)} ứng trước)`;
    if (p.paid) line += " ✅";
    lines.push(line);
  }
  lines.push("");
  lines.push("Chi tiết:");
  for (const e of summary.expenses) {
    const parts = [splitLabel(summary, e.id, memberName)];
    if (e.paidBy) parts.push(`${memberName(e.paidBy)} ứng`);
    lines.push(`- ${e.title || "Khoản chi"}: ${formatVND(e.amount)} (${parts.join(", ")})`);
  }
  if (url) {
    lines.push("");
    lines.push(url);
  }
  return lines.join("\n");
}
