import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ExternalLink, MoreVertical } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "../../components/Badge";
import { useMatches } from "../resume/useResume";
import { formatRelativeDate } from "../../lib/format";
import { safeHttpUrl } from "../../lib/url";
import type { JobApplication } from "../../lib/types";

type Props = {
  app: JobApplication;
  onEdit: (app: JobApplication) => void;
  onDelete: (app: JobApplication) => void;
  onView?: (app: JobApplication) => void;
};

export function ApplicationCard({ app, onEdit, onDelete, onView }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: matchData } = useMatches();
  const liveMatch = matchData?.matches?.[app.id];
  const matchScore = liveMatch?.score ?? null;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: app.id,
    data: { type: "application", app },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-card="true"
      onClick={() => onView?.(app)}
      className="group bg-surface-elevated border border-border-subtle rounded-xl p-4 hover:border-border transition-colors cursor-pointer active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-ink-primary truncate">{app.companyName}</div>
          <div className="text-sm text-ink-secondary truncate">{app.position}</div>
        </div>
        <div className="relative shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1 rounded text-ink-muted hover:text-ink-primary hover:bg-surface-subtle opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
            aria-label="Card menu"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
                onPointerDown={(e) => e.stopPropagation()}
              />
              <div
                className="absolute right-0 mt-1 w-32 bg-surface-elevated border border-border rounded-md shadow-elevated z-20 py-1 text-sm"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  className="block w-full px-3 py-1.5 text-left hover:bg-surface-subtle"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onEdit(app);
                  }}
                >
                  Edit
                </button>
                <button
                  className="block w-full px-3 py-1.5 text-left text-status-rejected hover:bg-status-rejected/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onDelete(app);
                  }}
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {(() => {
        const safe = safeHttpUrl(app.jobLink);
        if (!safe) return null;
        return (
          <a
            href={safe.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-accent transition-colors mb-2"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3" />
            <span className="truncate max-w-[200px]">{safe.hostname}</span>
          </a>
        );
      })()}

      {app.notes && (
        <p className="text-xs text-ink-secondary line-clamp-2 mb-2">{app.notes}</p>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-subtle">
        <StatusBadge status={app.status} />
        <span className="text-xs text-ink-muted">{formatRelativeDate(app.dateApplied || app.createdAt)}</span>
      </div>

      {matchScore != null && (
        <div
          className="mt-2 flex items-center gap-2 text-xs"
          title={
            liveMatch
              ? `Matched: ${liveMatch.matched.join(", ") || "—"}\nMissing: ${liveMatch.missing.join(", ") || "—"}`
              : undefined
          }
        >
          <span className="text-ink-muted">Match</span>
          <div className="relative flex-1 h-1.5 bg-surface-subtle rounded-full overflow-hidden">
            {/* Gradient lives at fixed positions across the whole bar; clip-path
                reveals only the left portion based on score — so 30% reads as red,
                60% as yellow, 90%+ as green. */}
            <div
              className="absolute inset-0 bg-gradient-to-r from-status-rejected via-status-interview to-status-offer transition-[clip-path] duration-500"
              style={{
                clipPath: `inset(0 ${100 - Math.min(100, Math.max(0, matchScore))}% 0 0)`,
              }}
            />
          </div>
          <span className="text-ink-primary font-medium">{matchScore}</span>
        </div>
      )}
    </div>
  );
}
