"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Plus, RefreshCw, Users } from "lucide-react";
import { useCallback, useState, useSyncExternalStore } from "react";
import { SWRConfig } from "swr";
import { allMonths, currentMonth, shiftMonth, summarizeMonth } from "@/lib/calc";
import { ApiError, localCacheProvider, useAppData, type DataResponse } from "@/lib/client";
import { formatMonth, formatVND } from "@/lib/format";
import type { CategoryKey, Expense } from "@/lib/types";
import { ExpenseForm, type EditorState } from "./expense-form";
import { HistoryView } from "./history-view";
import { Logo } from "./logo";
import { MembersForm } from "./members-form";
import { MonthView } from "./month-view";
import { Button, cx, Segmented, Sheet, Toaster } from "./ui";

const noopSubscribe = () => () => {};

export function App({ canLogout }: { canLogout: boolean }) {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  if (!mounted) return <Skeleton />;
  return (
    <SWRConfig value={{ provider: localCacheProvider }}>
      <Main canLogout={canLogout} />
      <Toaster />
    </SWRConfig>
  );
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function Main({ canLogout }: { canLogout: boolean }) {
  const { data, error, actions, mutate, isValidating } = useAppData();
  const [view, setView] = useState<"month" | "history">("month");
  const [month, setMonth] = useState<string | null>(() => {
    const m = new URLSearchParams(window.location.search).get("m");
    return m && MONTH_RE.test(m) ? m : null;
  });
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const closeEditor = useCallback(() => setEditorOpen(false), []);
  const closeMembers = useCallback(() => setMembersOpen(false), []);
  const closePicker = useCallback(() => setPickerOpen(false), []);

  if (!data) {
    if (error) return <ErrorState error={error} retry={() => mutate()} />;
    return <Skeleton />;
  }

  const months = allMonths(data);
  const latest = months.at(-1) ?? currentMonth();
  const active = month ?? latest;
  const minMonth = months[0] ?? active;
  const maxMonth = [shiftMonth(latest, 1), currentMonth()].sort().at(-1)!;
  const summary = summarizeMonth(data, active);

  function goto(m: string) {
    setMonth(m);
    setView("month");
    window.history.replaceState(null, "", `?m=${m}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openEditor(state: Omit<EditorState, "key">) {
    setEditor({ ...state, key: Date.now() });
    setEditorOpen(true);
  }

  const relative =
    active === currentMonth() ? "Tháng này" : active === shiftMonth(currentMonth(), -1) ? "Tháng trước" : null;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
          <button type="button" onClick={() => goto(latest)} className="flex items-center gap-2.5">
            <Logo className="size-8" />
            <span className="hidden text-[17px] font-bold tracking-tight min-[400px]:inline">Tiền nhà</span>
          </button>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "month", label: "Tháng" },
              { value: "history", label: "Lịch sử" },
            ]}
            className="w-44"
          />
          <button
            type="button"
            onClick={() => setMembersOpen(true)}
            aria-label="Thành viên"
            className="grid size-10 place-items-center rounded-full text-ink-2 transition hover:bg-surface-2 hover:text-ink"
          >
            <Users className="size-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-36 pt-4">
        {data.storage === "file" && (
          <p className="mb-4 rounded-2xl bg-surface-2 px-4 py-2.5 text-[13px] text-ink-2">
            Đang dùng dữ liệu thử trên máy (chưa kết nối Google Sheets).
          </p>
        )}

        {view === "month" ? (
          <>
            <div className="mb-4 flex items-center justify-between gap-2">
              <NavButton disabled={active <= minMonth} onClick={() => goto(shiftMonth(active, -1))} label="Tháng trước">
                <ChevronLeft className="size-5" />
              </NavButton>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="flex flex-col items-center rounded-2xl px-4 py-1 transition hover:bg-surface-2"
              >
                <span className="flex items-center gap-1 text-xl font-bold tracking-tight">
                  Tháng {formatMonth(active)}
                  <ChevronDown className="size-4 text-muted" />
                </span>
                <span className="flex h-4 items-center gap-1 text-xs text-muted">
                  {isValidating ? (
                    <>
                      <RefreshCw className="size-3 animate-spin" /> Đang đồng bộ…
                    </>
                  ) : (
                    relative
                  )}
                </span>
              </button>
              <NavButton disabled={active >= maxMonth} onClick={() => goto(shiftMonth(active, 1))} label="Tháng sau">
                <ChevronRight className="size-5" />
              </NavButton>
            </div>
            <div key={active}>
              <MonthView
                data={data}
                summary={summary}
                actions={actions}
                onAdd={(category?: CategoryKey) => openEditor({ category })}
                onEdit={(expense: Expense) => openEditor({ expense })}
              />
            </div>
          </>
        ) : (
          <HistoryView data={data} onOpen={goto} />
        )}
      </main>

      {view === "month" && summary.expenses.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center pb-[max(env(safe-area-inset-bottom),20px)] sm:justify-end sm:px-8">
          <button
            type="button"
            onClick={() => openEditor({})}
            className="pointer-events-auto flex h-14 items-center gap-2 rounded-full bg-primary pl-5 pr-6 font-semibold text-primary-ink shadow-[0_8px_30px_rgba(0,0,0,0.25)] transition hover:scale-[1.02] active:scale-95"
          >
            <Plus className="size-5" strokeWidth={2.5} />
            Thêm khoản chi
          </button>
        </div>
      )}

      <Sheet
        open={editorOpen}
        onClose={closeEditor}
        title={editor?.expense ? "Sửa khoản chi" : `Thêm khoản chi · ${formatMonth(active)}`}
      >
        {editor && (
          <ExpenseForm
            key={editor.key}
            data={data}
            month={editor.expense?.month ?? active}
            editor={editor}
            actions={actions}
            onDone={closeEditor}
          />
        )}
      </Sheet>

      <Sheet open={membersOpen} onClose={closeMembers} title="Thành viên">
        {membersOpen && (
          <MembersForm
            members={data.members}
            actions={actions}
            onDone={closeMembers}
            canLogout={canLogout}
            storage={data.storage}
          />
        )}
      </Sheet>

      <Sheet open={pickerOpen} onClose={closePicker} title="Chọn tháng">
        <MonthPicker
          data={data}
          months={months}
          active={active}
          next={maxMonth}
          onPick={(m) => {
            closePicker();
            goto(m);
          }}
        />
      </Sheet>
    </>
  );
}

function NavButton({
  children,
  disabled,
  onClick,
  label,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid size-11 place-items-center rounded-full bg-surface text-ink ring-1 ring-line transition hover:bg-surface-2 active:scale-90 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function MonthPicker({
  data,
  months,
  active,
  next,
  onPick,
}: {
  data: DataResponse;
  months: string[];
  active: string;
  next: string;
  onPick: (m: string) => void;
}) {
  const list = [...new Set([...months, next])].sort().reverse();
  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl ring-1 ring-line">
      {list.map((m) => {
        const s = summarizeMonth(data, m);
        const unpaid = s.people.filter((p) => !p.paid && Math.abs(p.due) > 0.004).length;
        const isNew = !s.expenses.length;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onPick(m)}
            className={cx(
              "flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-surface-2/60",
              m === active && "bg-surface-2",
            )}
          >
            <span>
              <span className="block font-semibold">Tháng {formatMonth(m)}</span>
              <span className="text-[13px] text-muted">
                {isNew ? "Chưa có khoản chi" : unpaid ? `${unpaid} người chưa đóng` : "Đã đóng đủ"}
              </span>
            </span>
            {isNew ? (
              <span className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-ink">
                <Plus className="size-3.5" strokeWidth={3} /> Tạo
              </span>
            ) : (
              <span className="tabular font-semibold">{formatVND(s.total)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ErrorState({ error, retry }: { error: Error; retry: () => void }) {
  const notConfigured = error instanceof ApiError && error.status === 503;
  return (
    <div className="mx-auto mt-24 max-w-md px-4 text-center">
      <Logo className="mx-auto size-12" />
      <h1 className="mt-5 text-xl font-semibold">
        {notConfigured ? "Chưa kết nối Google Sheets" : "Không tải được dữ liệu"}
      </h1>
      <p className="mt-2 text-sm text-ink-2">{error.message}</p>
      <Button variant="primary" className="mt-6" onClick={retry}>
        <RefreshCw className="size-4" /> Thử lại
      </Button>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse px-4 pt-4" aria-busy="true" aria-label="Đang tải">
      <div className="mb-6 flex h-12 items-center justify-between">
        <div className="size-8 rounded-xl bg-surface-3" />
        <div className="h-9 w-52 rounded-full bg-surface-3" />
        <div className="size-9 rounded-full bg-surface-3" />
      </div>
      <div className="mx-auto mb-5 h-8 w-48 rounded-full bg-surface-3" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="h-52 rounded-3xl bg-surface-3" />
          <div className="h-16 rounded-3xl bg-surface-3" />
          <div className="h-16 rounded-3xl bg-surface-3" />
          <div className="h-16 rounded-3xl bg-surface-3" />
        </div>
        <div className="h-96 rounded-3xl bg-surface-3" />
      </div>
    </div>
  );
}
