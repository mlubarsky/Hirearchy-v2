import { AlertCircle, Calendar, Check, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { StatusBadge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { formatRelativeDate } from "../../lib/format";
import { safeHttpUrl } from "../../lib/url";
import type { JobApplication } from "../../lib/types";
import { useMatches } from "../resume/useResume";

type Props = {
  app: JobApplication | null;
  onClose: () => void;
  onEdit: (app: JobApplication) => void;
  onDelete: (app: JobApplication) => void;
};

function Chip({ label, tone }: { label: string; tone: "matched" | "missing" }) {
  const cls =
    tone === "matched"
      ? "bg-status-offer/15 text-status-offer border-status-offer/30"
      : "bg-status-rejected/10 text-status-rejected border-status-rejected/30";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cls}`}>
      {label}
    </span>
  );
}

export function ApplicationDetailModal({ app, onClose, onEdit, onDelete }: Props) {
  const { data: matchData } = useMatches();

  if (!app) return null;

  const match = matchData?.matches?.[app.id];
  const link = safeHttpUrl(app.jobLink);
  const score = match?.score ?? null;

  return (
    <Modal open onClose={onClose} title={app.companyName} maxWidth="max-w-2xl">
      <div className="space-y-4">
        {/* position + status */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="text-base text-ink-secondary">{app.position}</div>
          </div>
          <StatusBadge status={app.status} />
        </div>

        {/* meta line */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
          {app.dateApplied && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Applied {formatRelativeDate(app.dateApplied)}
            </span>
          )}
          {link && (
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent hover:text-accent-hover transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              {link.hostname}
            </a>
          )}
        </div>

        {/* resume match section */}
        {score !== null && match && (
          <div className="rounded-lg border border-border-subtle bg-surface-subtle/30 p-3 space-y-2.5">
            <div className="flex items-baseline justify-between">
              <div className="text-xs uppercase tracking-wider text-ink-muted">
                Resume match
              </div>
              <div className="text-lg font-bold text-ink-primary">{score}%</div>
            </div>
            <div className="relative h-1.5 bg-surface-subtle rounded-full overflow-hidden">
              <div
                className="absolute inset-0 bg-gradient-to-r from-status-rejected via-status-interview to-status-offer transition-[clip-path] duration-500"
                style={{
                  clipPath: `inset(0 ${100 - Math.min(100, Math.max(0, score))}% 0 0)`,
                }}
              />
            </div>
            {match.matched.length > 0 && (
              <div className="flex items-start gap-2">
                <Check className="h-3 w-3 text-status-offer mt-1 shrink-0" />
                <div className="flex flex-wrap gap-1">
                  {match.matched.map((s) => (
                    <Chip key={s} label={s} tone="matched" />
                  ))}
                </div>
              </div>
            )}
            {match.missing.length > 0 && (
              <div className="flex items-start gap-2">
                <AlertCircle className="h-3 w-3 text-status-rejected mt-1 shrink-0" />
                <div className="flex flex-wrap gap-1">
                  {match.missing.map((s) => (
                    <Chip key={s} label={s} tone="missing" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* job description */}
        {app.jobDesc && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-ink-muted mb-1.5 font-semibold">
              Job description
            </div>
            <div className="text-sm text-ink-primary whitespace-pre-wrap max-h-60 overflow-y-auto rounded-md bg-surface-subtle/30 p-3 border border-border-subtle">
              {app.jobDesc}
            </div>
          </div>
        )}

        {/* notes */}
        {app.notes && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-ink-muted mb-1.5 font-semibold">
              Notes
            </div>
            <div className="text-sm text-ink-primary whitespace-pre-wrap rounded-md bg-surface-subtle/30 p-3 border border-border-subtle">
              {app.notes}
            </div>
          </div>
        )}

        {!app.jobDesc && !app.notes && (
          <p className="text-xs text-ink-muted italic">
            No description or notes yet. Click Edit to add them.
          </p>
        )}

        {/* footer actions */}
        <div className="flex justify-between gap-2 pt-3 border-t border-border-subtle">
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => onDelete(app)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
          <div className="flex gap-2">
            {/* <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button> */}
            <Button type="button" size="sm" onClick={() => onEdit(app)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
