import { Lightbulb, Plus, Sparkles } from "lucide-react";
import { Card } from "../../components/Card";
import { useToast } from "../../components/Toast";
import { ApiError } from "../../lib/api";
import { KIND_DOT, formatDateTime } from "../../lib/format";
import type { Nudge } from "../../lib/types";
import { useMaterializeNudge, useNudges } from "./useCalendar";

export function NudgesPanel() {
  const { data: nudges = [], isLoading } = useNudges();
  const materialize = useMaterializeNudge();
  const toast = useToast();

  function handleAdd(nudge: Nudge) {
    materialize.mutate(nudge, {
      onSuccess: () => {
        toast.show({
          variant: "success",
          title: "Added to reminders",
          description: `${nudge.title} · ${formatDateTime(nudge.suggestedDueAt)}`,
        });
      },
      onError: (err) => {
        if (err instanceof ApiError && err.status === 409) {
          toast.show({ variant: "info", title: "Already in your reminders" });
          return;
        }
        toast.show({
          variant: "error",
          title: "Couldn't add reminder",
          description: err instanceof Error ? err.message : "Try again in a moment.",
        });
      },
    });
  }

  if (isLoading) {
    return <div className="text-sm text-ink-muted">Loading nudges...</div>;
  }

  return (
    <Card className="p-4 flex flex-col min-h-0 lg:h-80">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-semibold">Smart nudges</h3>
        <span className="text-xs text-ink-muted">{nudges.length}</span>
      </div>

      {nudges.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-ink-muted py-2">
          <Lightbulb className="h-4 w-4" />
          <span>All caught up. Nothing needs nudging right now.</span>
        </div>
      ) : (
        <ul className="divide-y divide-border-subtle max-h-[280px] lg:max-h-none lg:flex-1 min-h-0 overflow-y-auto -mr-1 pr-1">
          {nudges.map((n) => (
            <li key={n.id} className="group flex items-start gap-2 py-2.5">
              <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${KIND_DOT[n.kind]}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-ink-primary">{n.title}</div>
                <div className="text-xs text-ink-secondary mt-0.5">{n.reason}</div>
                <div className="text-xs text-ink-muted mt-0.5">
                  Suggested {formatDateTime(n.suggestedDueAt)}
                </div>
              </div>
              <button
                onClick={() => handleAdd(n)}
                className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded text-ink-muted hover:text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
                title="Add to reminders"
                aria-label="Add to reminders"
              >
                <Plus className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
