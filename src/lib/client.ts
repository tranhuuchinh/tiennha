"use client";

import useSWR from "swr";
import { toast } from "@/components/ui";
import type { AppData, Expense, ExpenseInput, Member, MonthMeta } from "./types";

export type DataResponse = AppData & { storage: "sheets" | "file" };

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json" } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) window.location.reload();
    throw new ApiError(body.error ?? `Lỗi ${res.status}`, res.status);
  }
  return body as T;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

function draftExpense(input: ExpenseInput, id: string, createdAt: string): Expense {
  const amount =
    input.split.mode === "custom" ? Object.values(input.split.shares).reduce((a, b) => a + b, 0) : input.amount;
  const now = new Date().toISOString();
  return { ...input, amount, id, createdAt, updatedAt: now };
}

const upsertMonth = (months: MonthMeta[], meta: MonthMeta) => [...months.filter((m) => m.month !== meta.month), meta];

export function useAppData() {
  const swr = useSWR<DataResponse>("/api/data", (url: string) => api<DataResponse>(url), {
    revalidateOnFocus: true,
    keepPreviousData: true,
    dedupingInterval: 4000,
    errorRetryCount: 2,
  });
  const { mutate } = swr;

  async function run<R>(
    request: () => Promise<R>,
    optimistic: (d: DataResponse) => DataResponse,
    apply: (d: DataResponse, result: R) => DataResponse,
  ) {
    try {
      await mutate(
        async (current) => {
          const result = await request();
          return current ? apply(current, result) : current;
        },
        {
          optimisticData: (current) => (current ? optimistic(current) : (current as unknown as DataResponse)),
          rollbackOnError: true,
          populateCache: true,
          revalidate: false,
        },
      );
      return true;
    } catch (err) {
      toast(err instanceof Error ? err.message : "Có lỗi xảy ra", "error");
      return false;
    }
  }

  const actions = {
    createExpenses(inputs: ExpenseInput[]) {
      const now = new Date().toISOString();
      const drafts = inputs.map((i, n) => draftExpense(i, `tmp-${Date.now()}-${n}`, now));
      return run(
        () => api<{ expenses: Expense[] }>("/api/expenses", json("POST", { expenses: inputs })),
        (d) => ({ ...d, expenses: [...d.expenses, ...drafts] }),
        (d, r) => ({ ...d, expenses: [...d.expenses, ...r.expenses] }),
      );
    },

    updateExpense(id: string, input: ExpenseInput) {
      return run(
        () => api<{ expense: Expense }>(`/api/expenses/${id}`, json("PUT", input)),
        (d) => ({
          ...d,
          expenses: d.expenses.map((e) => (e.id === id ? draftExpense(input, id, e.createdAt) : e)),
        }),
        (d, r) => ({ ...d, expenses: d.expenses.map((e) => (e.id === id ? r.expense : e)) }),
      );
    },

    deleteExpense(id: string) {
      const drop = (d: DataResponse) => ({ ...d, expenses: d.expenses.filter((e) => e.id !== id) });
      return run(() => api(`/api/expenses/${id}`, json("DELETE")), drop, drop);
    },

    saveMonth(meta: Omit<MonthMeta, "updatedAt">) {
      return run(
        () => api<{ month: MonthMeta }>(`/api/months/${meta.month}`, json("PUT", meta)),
        (d) => ({ ...d, months: upsertMonth(d.months, { ...meta, updatedAt: new Date().toISOString() }) }),
        (d, r) => ({ ...d, months: upsertMonth(d.months, r.month) }),
      );
    },

    saveMembers(members: Member[]) {
      return run(
        () => api<{ members: Member[] }>("/api/members", json("PUT", { members })),
        (d) => ({ ...d, members }),
        (d, r) => ({ ...d, members: r.members }),
      );
    },
  };

  return { ...swr, actions };
}

export type Actions = ReturnType<typeof useAppData>["actions"];

/** Cache SWR vào localStorage để mở app là thấy dữ liệu ngay */
export function localCacheProvider() {
  const KEY = "tiennha-cache-v1";
  let map = new Map<string, unknown>();
  try {
    map = new Map(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
  } catch {}
  const persist = () => {
    try {
      const entries = [...map.entries()]
        .filter(([k, v]) => k === "/api/data" && (v as { data?: unknown })?.data)
        .map(([k, v]) => [k, { data: (v as { data: unknown }).data }]);
      localStorage.setItem(KEY, JSON.stringify(entries));
    } catch {}
  };
  window.addEventListener("pagehide", persist);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && persist());
  return map as Map<string, never>;
}
