import { Check, Pencil, X } from "lucide-react";
import { useState } from "react";
import { useToast } from "../../components/Toast";
import { STATUS_DOT } from "../../lib/format";
import type { JobApplication } from "../../lib/types";
import { useUpdateStatusDate } from "./useApplications";

const DAY_MS = 86_400_000;

/** YYYY-MM-DD for an <input type="date">, in the user's timezone. */
function toDateInput(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** A picked calendar day → an instant at local noon, so it never slips a day. */
function fromDateInput(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 12).toISOString();
}

function gapLabel(from: string | null, to: string | null): string | null {
  if (!from || !to) return null;
  const days = Math.round((new Date(to).getTime() - new Date(from).getTime()) / DAY_MS);
  if (days <= 0) return "same day";
  return days === 1 ? "1 day later" : `${days} days later`;
}

export function StatusTimeline({ app }: { app: JobApplication }) {
  const updateDate = useUpdateStatusDate();
  const toast = useToast();
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  const history = app.statusHistory ?? [];
  if (history.length === 0) return null;

  function startEdit(index: number, at: string | null) {
    setEditing(index);
    setDraft(at ? toDateInput(at) : "");
  }

  async function save(index: number) {
    if (!draft) return;
    try {
      await updateDate.mutateAsync({ id: app.id, index, at: fromDateInput(draft) });
      setEditing(null);
    } catch (err) {
      toast.show({
        variant: "error",
        title: "Couldn't update date",
        description: err instanceof Error ? err.message : "Try again.",
      });
    }
  }

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted mb-2 font-semibold">
        Timeline
      </div>
      <ol className="relative">
        {history.map((entry, i) => {
          const last = i === history.length - 1;
          const gap = i > 0 ? gapLabel(history[i - 1].at, entry.at) : null;
          return (
            <li key={i} className="relative flex gap-3 pb-3 last:pb-0">
              {/* rail */}
              {!last && (
                <span className="absolute left-[4px] top-3 bottom-0 w-px bg-border" aria-hidden />
              )}
              <span
                className={`relative mt-1.5 h-[9px] w-[9px] shrink-0 rounded-full ring-2 ring-surface-elevated ${STATUS_DOT[entry.status]}`}
              />
              <div className="min-w-0 flex-1 flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm">
                  <span className="text-ink-primary font-medium">{entry.status}</span>
                  {gap && <span className="text-xs text-ink-muted"> · {gap}</span>}
                </div>

                {editing === i ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="date"
                      autoFocus
                      value={draft}
                      max={toDateInput(new Date().toISOString())}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") save(i);
                        if (e.key === "Escape") setEditing(null);
                      }}
                      aria-label={`${entry.status} date`}
                      className="h-7 rounded-md border border-border bg-surface-elevated px-2 text-xs text-ink-primary focus:outline-none focus:border-accent/60"
                    />
                    <button
                      type="button"
                      onClick={() => save(i)}
                      disabled={!draft || updateDate.isPending}
                      aria-label="Save date"
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-secondary hover:text-accent hover:bg-surface-subtle disabled:opacity-50 transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      aria-label="Cancel"
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-muted hover:text-ink-primary hover:bg-surface-subtle transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(i, entry.at)}
                    title="Change date"
                    className="group inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink-primary transition-colors"
                  >
                    {entry.at ? (
                      new Date(entry.at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    ) : (
                      <span className="italic">Date unknown — set it</span>
                    )}
                    <Pencil className="h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
