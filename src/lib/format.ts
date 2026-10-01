const vnd = new Intl.NumberFormat("vi-VN");
const k2 = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

/** 2472 -> "2.472.000đ" */
export function formatVND(k: number) {
  return `${vnd.format(Math.round(k * 1000))}đ`;
}

/** 2472 -> "2.472k", 186.75 -> "186,75k" */
export function formatK(k: number) {
  return `${k2.format(Math.round(k * 100) / 100)}k`;
}

/** 10188 -> "10,2tr", 747 -> "747k" */
export function formatShort(k: number) {
  if (Math.abs(k) >= 1000) {
    return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(k / 1000)}tr`;
  }
  return `${vnd.format(Math.round(k))}k`;
}

/** "2026-09" -> "09/2026" */
export function formatMonth(month: string) {
  const [y, m] = month.split("-");
  return `${m}/${y}`;
}

/** Đọc số người dùng gõ: "1.800", "186,75", "1800" */
export function parseAmount(input: string): number {
  const s = input.trim().replace(/\s/g, "");
  if (!s) return NaN;
  let normalized = s;
  if (s.includes(",")) {
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    normalized = s.replace(/\./g, "");
  }
  return Number(normalized);
}

export function amountToInput(k: number) {
  if (!Number.isFinite(k) || k === 0) return "";
  return String(Math.round(k * 100) / 100).replace(".", ",");
}
