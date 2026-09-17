import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { Input } from "../../components/Input";
import { KIND_COLORS, KIND_LABEL, formatDateTime } from "../../lib/format";
import type { CalendarEvent, JobApplication, Reminder } from "../../lib/types";
import { useApplications } from "../applications/useApplications";
import { EventModal } from "../calendar/EventModal";
import {
  useCreateReminder,
  useDeleteReminder,
  useReminders,
  useReorderReminders,
  useUpdateReminder,
} from "./useReminders";

function reminderToEvent(r: Reminder): CalendarEvent {
  return {
    id: r.id,
    source: "reminder",
    kind: r.kind,
    title: r.text,
    start: r.dueAt ?? "", // quick reminders have no date; the modal treats "" as undated
    end: r.endAt ?? null,
    notes: r.notes ?? null,
    applicationId: r.applicationId ?? null,
    completed: r.completed,
  };
}

function ReminderRow({
  reminder,
  onToggle,
  onDelete,
  onEdit,
}: {
  reminder: Reminder;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: reminder.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="group flex items-start gap-2 py-2 px-1 rounded-md hover:bg-surface-subtle/50 transition-colors"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-ink-muted hover:text-ink-secondary cursor-grab active:cursor-grabbing opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity pt-0.5"
        aria-label="Drag handle"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <input
        type="checkbox"
        checked={reminder.completed}
        onChange={onToggle}
        className="h-4 w-4 mt-0.5 rounded border-border bg-surface-elevated text-accent focus:ring-accent/40"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`text-sm ${reminder.completed ? "text-ink-muted line-through" : "text-ink-primary"}`}
          >
            {reminder.text}
          </span>
          {reminder.kind !== "task" && (
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${KIND_COLORS[reminder.kind]}`}
            >
              {KIND_LABEL[reminder.kind]}
            </span>
          )}
        </div>
        {reminder.dueAt && (
          <div className="flex items-center gap-1 text-[11px] text-ink-muted mt-0.5">
            <CalendarClock className="h-3 w-3" />
            {formatDateTime(reminder.dueAt)}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="text-ink-muted hover:text-ink-primary p-1"
          aria-label="Edit reminder"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="text-ink-muted hover:text-status-rejected p-1"
          aria-label="Delete reminder"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

export function RemindersPanel() {
  const { data: reminders = [] } = useReminders();
  const { data: applications = [] } = useApplications();
  const create = useCreateReminder();
  const update = useUpdateReminder();
  const remove = useDeleteReminder();
  const reorder = useReorderReminders();
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [showFullModal, setShowFullModal] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleQuickAdd() {
    if (!text.trim()) return;
    create.mutate({ text: text.trim() });
    setText("");
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleQuickAdd();
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = reminders.findIndex((r) => r.id === active.id);
    const newIndex = reminders.findIndex((r) => r.id === over.id);
    const next = arrayMove(reminders, oldIndex, newIndex);
    const items = next.map((r, i) => ({ id: r.id, orderIndex: i }));
    reorder.mutate(items);
  }

  const open = reminders.filter((r) => !r.completed);
  const done = reminders.filter((r) => r.completed);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Quick reminder..."
          className="flex-1"
        />
        <button
          onClick={handleQuickAdd}
          className="shrink-0 h-10 w-10 rounded-lg bg-accent text-accent-fg hover:bg-accent-hover transition-colors flex items-center justify-center"
          aria-label="Add reminder"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <button
        onClick={() => setShowFullModal(true)}
        className="w-full text-xs text-ink-secondary hover:text-ink-primary text-left flex items-center gap-1.5 py-1"
      >
        <CalendarClock className="h-3.5 w-3.5" />
        Schedule a dated event instead →
      </button>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={open.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <ul className="divide-y divide-border-subtle">
            {open.map((r) => (
              <ReminderRow
                key={r.id}
                reminder={r}
                onToggle={() => update.mutate({ id: r.id, patch: { completed: true } })}
                onDelete={() => remove.mutate(r.id)}
                onEdit={() => setEditing(r)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {open.length === 0 && (
        <p className="text-sm text-ink-muted text-center py-4">All clear. Add a reminder above.</p>
      )}

      {done.length > 0 && (
        <details className="text-sm">
          <summary className="text-ink-muted cursor-pointer hover:text-ink-secondary py-1">
            Completed ({done.length})
          </summary>
          <ul className="divide-y divide-border-subtle mt-2">
            {done.map((r) => (
              <ReminderRow
                key={r.id}
                reminder={r}
                onToggle={() => update.mutate({ id: r.id, patch: { completed: false } })}
                onDelete={() => remove.mutate(r.id)}
                onEdit={() => setEditing(r)}
              />
            ))}
          </ul>
        </details>
      )}

      <EventModal
        open={editing !== null || showFullModal}
        onClose={() => {
          setEditing(null);
          setShowFullModal(false);
        }}
        event={editing ? reminderToEvent(editing) : null}
        applications={applications as JobApplication[]}
      />
    </div>
  );
}
