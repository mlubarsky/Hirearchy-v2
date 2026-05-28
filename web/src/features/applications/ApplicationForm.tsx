import { ArrowLeft, Pencil } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "../../components/Button";
import { Input, Label, Select, Textarea } from "../../components/Input";
import { todayIso } from "../../lib/format";
import { STATUSES, type JobApplication, type JobApplicationInput } from "../../lib/types";
import { AutoFillPanel } from "./AutoFillPanel";
import type { ParsedJob } from "./useParseJob";

type Props = {
  initial?: JobApplication;
  onSubmit: (data: JobApplicationInput) => Promise<unknown>;
  onCancel: () => void;
  submitLabel?: string;
};

type ViewMode = "choose" | "manual";

export function ApplicationForm({ initial, onSubmit, onCancel, submitLabel = "Save" }: Props) {
  const isEditing = Boolean(initial?.id);

  // Editing an existing app skips the chooser entirely — go straight to fields.
  const [view, setView] = useState<ViewMode>(isEditing ? "manual" : "choose");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState(initial?.companyName ?? "");
  const [position, setPosition] = useState(initial?.position ?? "");
  const [jobLink, setJobLink] = useState(initial?.jobLink ?? "");
  const [jobDesc, setJobDesc] = useState(initial?.jobDesc ?? "");
  const [dateApplied, setDateApplied] = useState(initial?.dateApplied ?? todayIso());
  const [status, setStatus] = useState(initial?.status ?? "Applied");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!companyName.trim() || !position.trim()) {
      setError("Company and position are required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        companyName: companyName.trim(),
        position: position.trim(),
        jobLink: jobLink.trim() || undefined,
        jobDesc: jobDesc.trim() || undefined,
        dateApplied: dateApplied || undefined,
        status: status as JobApplication["status"],
        notes: notes.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function handleAutoFill(parsed: ParsedJob) {
    if (parsed.companyName) setCompanyName(parsed.companyName);
    if (parsed.position) setPosition(parsed.position);
    if (parsed.jobLink) setJobLink(parsed.jobLink);
    if (parsed.jobDesc) setJobDesc(parsed.jobDesc);
    if (parsed.notes) {
      setNotes((prev) => (prev.trim() ? `${parsed.notes}\n\n${prev}` : parsed.notes!));
    }
    // Hop to the manual form so the user can review/edit before saving.
    setView("manual");
  }

  if (view === "choose") {
    return (
      <div className="space-y-3">
        <AutoFillPanel
          onApply={handleAutoFill}
          defaultOpen
          dismissable={false}
        />

        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-border-subtle" />
          <span className="text-xs uppercase tracking-wider text-ink-muted">or</span>
          <div className="flex-1 h-px bg-border-subtle" />
        </div>

        <button
          type="button"
          onClick={() => setView("manual")}
          className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-surface-elevated/50 hover:border-accent/50 hover:bg-accent/5 transition-colors text-left group"
        >
          <div className="shrink-0 h-9 w-9 rounded-lg bg-surface-subtle flex items-center justify-center group-hover:bg-accent/10 transition-colors">
            <Pencil className="h-4 w-4 text-ink-secondary group-hover:text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-ink-primary">Manually input</div>
            <div className="text-xs text-ink-secondary">Fill in each field yourself.</div>
          </div>
        </button>

        <div className="flex justify-end pt-1">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isEditing && (
        <button
          type="button"
          onClick={() => setView("choose")}
          className="inline-flex items-center gap-1 text-xs text-ink-secondary hover:text-ink-primary -mt-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to options
        </button>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="companyName">Company *</Label>
          <Input
            id="companyName"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Inc."
            autoFocus
            required
          />
        </div>
        <div>
          <Label htmlFor="position">Position *</Label>
          <Input
            id="position"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="Software Engineer"
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="jobLink">Job link</Label>
        <Input
          id="jobLink"
          type="url"
          value={jobLink}
          onChange={(e) => setJobLink(e.target.value)}
          placeholder="https://example.com/job"
        />
      </div>

      <div>
        <Label htmlFor="jobDesc">Job description</Label>
        <Textarea
          id="jobDesc"
          value={jobDesc}
          onChange={(e) => setJobDesc(e.target.value)}
          placeholder="Paste the role description..."
          rows={4}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="dateApplied">Date applied</Label>
          <Input
            id="dateApplied"
            type="date"
            value={dateApplied}
            onChange={(e) => setDateApplied(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as JobApplication["status"])}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Any notes or follow-ups..."
        />
      </div>

      {error && (
        <p className="text-sm text-status-rejected" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
