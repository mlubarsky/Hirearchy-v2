import { Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "../../components/Button";
import { Input, Label, Select, Textarea } from "../../components/Input";
import { Modal } from "../../components/Modal";
import { toDateTimeLocal } from "../../lib/format";
import {
  REMINDER_KINDS,
  REMINDER_KIND_LABEL,
  type CalendarEvent,
  type JobApplication,
  type Reminder,
  type ReminderKind,
} from "../../lib/types";
import {
  useCreateReminder,
  useDeleteReminder,
  useUpdateReminder,
} from "../reminders/useReminders";

type Props = {
  open: boolean;
  onClose: () => void;
  event?: CalendarEvent | null;
  defaultDate?: Date | null;
  applications: JobApplication[];
};

function localToIso(local: string): string {
  // datetime-local has no timezone; treat as local and convert to UTC ISO
  return new Date(local).toISOString();
}

/**
 * Mounts the form only while open, keyed by the event, so every open starts from
 * that event's values. (The form seeds its fields from props once, on mount — a
 * modal that stayed mounted kept showing whatever it was first opened with.)
 */
export function EventModal(props: Props) {
  if (!props.open) return null;
  return <EventModalForm key={props.event?.id ?? "new"} {...props} />;
}

function EventModalForm({ open, onClose, event, defaultDate, applications }: Props) {
  const create = useCreateReminder();
  const update = useUpdateReminder();
  const remove = useDeleteReminder();

  const isApplicationEvent = event?.source === "application";
  const editingReminderId = event?.source === "reminder" ? event.id : null;

  // Existing reminders may be undated (quick reminders): start "" = no date, and
  // the date stays optional when editing. New events always need a date.
  const initialStart = event
    ? event.start
      ? new Date(event.start)
      : null
    : defaultDate
      ? new Date(new Date(defaultDate).setHours(10, 0, 0, 0))
      : new Date();
  const dateRequired = !editingReminderId;

  const [title, setTitle] = useState(event?.title ?? "");
  const [kind, setKind] = useState<ReminderKind>(
    event && event.source === "reminder" && event.kind !== "application"
      ? (event.kind as ReminderKind)
      : "interview",
  );
  const [start, setStart] = useState(initialStart ? toDateTimeLocal(initialStart) : "");
  const [end, setEnd] = useState(event?.end ? toDateTimeLocal(new Date(event.end)) : "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [applicationId, setApplicationId] = useState(event?.applicationId ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setError(null);
    const payload = {
      text: title.trim(),
      kind,
      dueAt: start ? localToIso(start) : null,
      endAt: end ? localToIso(end) : null,
      notes: notes.trim() || null,
      applicationId: applicationId || null,
    };
    try {
      if (editingReminderId) {
        await update.mutateAsync({ id: editingReminderId, patch: payload as Partial<Reminder> });
      } else {
        await create.mutateAsync({
          text: payload.text,
          kind: payload.kind,
          dueAt: payload.dueAt ?? undefined,
          endAt: payload.endAt ?? undefined,
          notes: payload.notes ?? undefined,
          applicationId: payload.applicationId ?? undefined,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function handleDelete() {
    if (!editingReminderId) return;
    if (!confirm("Delete this event?")) return;
    await remove.mutateAsync(editingReminderId);
    onClose();
  }

  if (isApplicationEvent) {
    // Application milestones are read-only — they're derived from the application's date_applied.
    return (
      <Modal open={open} onClose={onClose} title="Application milestone">
        <div className="space-y-3 text-sm">
          <div>
            <div className="text-ink-muted text-xs uppercase tracking-wider mb-1">Title</div>
            <div className="text-ink-primary">{event?.title}</div>
          </div>
          {event?.notes && (
            <div>
              <div className="text-ink-muted text-xs uppercase tracking-wider mb-1">Position</div>
              <div className="text-ink-primary">{event.notes}</div>
            </div>
          )}
          <div>
            <div className="text-ink-muted text-xs uppercase tracking-wider mb-1">Date</div>
            <div className="text-ink-primary">{new Date(event!.start).toLocaleDateString()}</div>
          </div>
          <p className="text-xs text-ink-muted pt-2">
            Edit the dateApplied field on the application itself to change this.
          </p>
          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingReminderId ? (event?.start ? "Edit event" : "Edit reminder") : "New event"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="event-title">Title</Label>
          <Input
            id="event-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event Title"
            autoFocus
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="event-kind">Type</Label>
            <Select id="event-kind" value={kind} onChange={(e) => setKind(e.target.value as ReminderKind)}>
              {REMINDER_KINDS.map((k) => (
                <option key={k} value={k}>
                  {REMINDER_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="event-app">Linked application</Label>
            <Select
              id="event-app"
              value={applicationId ?? ""}
              onChange={(e) => setApplicationId(e.target.value)}
            >
              <option value="">— None —</option>
              {applications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.companyName} — {a.position}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="event-start">{dateRequired ? "Start" : "Date (optional)"}</Label>
            <Input
              id="event-start"
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              required={dateRequired}
            />
          </div>
          <div>
            <Label htmlFor="event-end">End (optional)</Label>
            <Input
              id="event-end"
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="event-notes">Notes</Label>
          <Textarea
            id="event-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Loop schedule, names of interviewers, talking points..."
            rows={3}
          />
        </div>

        {error && <p className="text-sm text-status-rejected">{error}</p>}

        <div className="flex justify-between items-center pt-2">
          {editingReminderId ? (
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 text-sm text-status-rejected hover:text-status-rejected/80"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {create.isPending || update.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
