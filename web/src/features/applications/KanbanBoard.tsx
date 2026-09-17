import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { LayoutGrid, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../components/Button";
import { useToast } from "../../components/Toast";
import { STATUS_DOT } from "../../lib/format";
import {
  STATUSES,
  type ApplicationStatus,
  type JobApplication,
} from "../../lib/types";
import { ApplicationCard } from "./ApplicationCard";
import { useDeleteApplication, useUpdateApplication } from "./useApplications";

type Props = {
  applications: JobApplication[];
  onEdit: (app: JobApplication) => void;
  onView: (app: JobApplication) => void;
  onAddInColumn: (status: ApplicationStatus) => void;
};

// Per-status classes for the column when it's the active drop target. Each
// uses its status's own color so the highlight matches the kanban "bucket"
// color (Applied = indigo, Interview = amber, Offer = green, Rejected = red).
// The matching CSS var is also set inline so the descendant card-tinting rule
// in index.css (driven by --drop-rgb) picks the right color too.
const COLUMN_OVER_CLASSES: Record<ApplicationStatus, string> = {
  Applied:
    "border-status-applied bg-status-applied/15 shadow-[0_0_0_3px_rgb(var(--status-applied)/0.25)]",
  Interview:
    "border-status-interview bg-status-interview/15 shadow-[0_0_0_3px_rgb(var(--status-interview)/0.25)]",
  Offer:
    "border-status-offer bg-status-offer/15 shadow-[0_0_0_3px_rgb(var(--status-offer)/0.25)]",
  Rejected:
    "border-status-rejected bg-status-rejected/15 shadow-[0_0_0_3px_rgb(var(--status-rejected)/0.25)]",
};

const STATUS_DROP_VAR: Record<ApplicationStatus, string> = {
  Applied: "var(--status-applied)",
  Interview: "var(--status-interview)",
  Offer: "var(--status-offer)",
  Rejected: "var(--status-rejected)",
};

const STATUS_TEXT: Record<ApplicationStatus, string> = {
  Applied: "text-status-applied",
  Interview: "text-status-interview",
  Offer: "text-status-offer",
  Rejected: "text-status-rejected",
};

const COLUMN_META: Record<ApplicationStatus, { hint: string; tint: string }> = {
  Applied: { hint: "Reaching out", tint: "from-status-applied/20" },
  Interview: { hint: "In the room", tint: "from-status-interview/20" },
  Offer: { hint: "Decisions", tint: "from-status-offer/20" },
  Rejected: { hint: "Closed", tint: "from-status-rejected/20" },
};

function Column({
  status,
  applications,
  activeDropStatus,
  hiddenOnMobile,
  onEdit,
  onDelete,
  onView,
  onMove,
  onAdd,
}: {
  status: ApplicationStatus;
  applications: JobApplication[];
  activeDropStatus: ApplicationStatus | null;
  /** Below lg, one column is shown at a time (picked with the status tabs). */
  hiddenOnMobile: boolean;
  onEdit: (app: JobApplication) => void;
  onDelete: (app: JobApplication) => void;
  onView: (app: JobApplication) => void;
  onMove: (app: JobApplication, status: ApplicationStatus) => void;
  onAdd: () => void;
}) {
  const { setNodeRef } = useDroppable({
    id: `column-${status}`,
    data: { type: "column", status },
  });
  // The droppable's own `isOver` only fires when the pointer is on the column's
  // bare padding. When the column is packed with cards, the pointer is always
  // over a card's sortable droppable instead. So we drive the highlight off the
  // global drag state that the parent watches — if the active drag target
  // resolves to *this* column, light up.
  const isOver = activeDropStatus === status;
  const meta = COLUMN_META[status];

  return (
    <div
      ref={setNodeRef}
      data-droptarget={isOver ? "true" : undefined}
      style={
        isOver
          ? ({ "--drop-rgb": STATUS_DROP_VAR[status] } as React.CSSProperties)
          : undefined
      }
      className={`${hiddenOnMobile ? "hidden lg:flex" : "flex"} flex-col rounded-xl border transition-colors max-lg:border-0 max-lg:bg-transparent lg:min-h-0 lg:h-full ${
        isOver
          ? COLUMN_OVER_CLASSES[status]
          : "border-border-subtle bg-surface-elevated/40"
      }`}
    >
      <div
        className={`hidden lg:flex items-center justify-between px-3 py-2.5 border-b border-border-subtle bg-gradient-to-b ${meta.tint} to-transparent rounded-t-xl`}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{status}</span>
          <span className="text-xs text-ink-muted">{applications.length}</span>
        </div>
        <button
          onClick={onAdd}
          className="p-1 rounded text-ink-muted hover:text-ink-primary hover:bg-surface-subtle"
          aria-label={`Add to ${status}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <SortableContext items={applications.map((a) => a.id)} strategy={verticalListSortingStrategy}>
        {/* Tabbed (below lg): cards in a grid — 1 column on phones, 2 on tablets.
            Board (lg+): a scrolling stack inside the column. */}
        <div className="flex-1 min-h-0 max-lg:grid max-lg:gap-2 sm:max-lg:grid-cols-2 max-lg:items-start lg:p-2 lg:space-y-2 overflow-y-auto">
          {applications.length === 0 ? (
            <div className="col-span-full text-center text-xs text-ink-muted py-8 italic">
              <span className="lg:hidden">No applications in {status} yet</span>
              <span className="hidden lg:inline">{meta.hint}</span>
            </div>
          ) : (
            applications.map((app) => (
              <ApplicationCard
                key={app.id}
                app={app}
                onEdit={onEdit}
                onDelete={onDelete}
                onView={onView}
                onMove={onMove}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

/** Status tab for the narrow (below lg) layout. Also a drop target, so a long-pressed card can be
 *  dragged onto another status. */
function StatusTab({
  status,
  count,
  selected,
  isOver,
  onSelect,
}: {
  status: ApplicationStatus;
  count: number;
  selected: boolean;
  isOver: boolean;
  onSelect: () => void;
}) {
  const { setNodeRef } = useDroppable({
    id: `tab-${status}`,
    data: { type: "column", status },
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={`flex-1 min-w-0 inline-flex items-center justify-center gap-1 h-8 px-1 rounded-md text-xs font-medium transition-colors ${
        isOver
          ? "bg-surface-subtle text-ink-primary ring-2 ring-accent/60"
          : selected
            ? "bg-surface-elevated dark:bg-border text-ink-primary shadow-card"
            : "text-ink-secondary hover:text-ink-primary"
      }`}
    >
      <span className="truncate">{status}</span>
      {/* The count carries the status color (no dot — "Interview" needs the room). */}
      <span className={`tabular-nums ${STATUS_TEXT[status]}`}>{count}</span>
    </button>
  );
}

export function KanbanBoard({ applications, onEdit, onView, onAddInColumn }: Props) {
  const update = useUpdateApplication();
  const remove = useDeleteApplication();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDropStatus, setActiveDropStatus] = useState<ApplicationStatus | null>(null);
  const [mobileStatus, setMobileStatus] = useState<ApplicationStatus>("Applied");
  const toast = useToast();
  // Mouse: drag after a small move. Touch: drag only after a long press, so a
  // swipe that starts on a card still scrolls the page.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const grouped = useMemo(() => {
    const map: Record<ApplicationStatus, JobApplication[]> = {
      Applied: [],
      Interview: [],
      Offer: [],
      Rejected: [],
    };
    for (const a of applications) map[a.status]?.push(a);
    return map;
  }, [applications]);

  const activeApp = activeId ? applications.find((a) => a.id === activeId) : null;

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragOver(e: DragOverEvent) {
    const overData = e.over?.data.current as
      | { type?: string; status?: ApplicationStatus; app?: JobApplication }
      | undefined;
    let next: ApplicationStatus | null = null;
    if (overData?.type === "column" && overData.status) next = overData.status;
    else if (overData?.type === "application" && overData.app) next = overData.app.status;
    setActiveDropStatus(next);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    setActiveDropStatus(null);
    const { active, over } = e;
    if (!over) return;

    const overData = over.data.current as { type?: string; status?: ApplicationStatus; app?: JobApplication } | undefined;
    const activeApp = applications.find((a) => a.id === active.id);
    if (!activeApp) return;

    let newStatus: ApplicationStatus | undefined;
    if (overData?.type === "column" && overData.status) newStatus = overData.status;
    else if (overData?.type === "application" && overData.app) newStatus = overData.app.status;

    if (newStatus && newStatus !== activeApp.status) {
      moveTo(activeApp, newStatus);
    }
  }

  function moveTo(app: JobApplication, status: ApplicationStatus) {
    update.mutate({ id: app.id, patch: { status } });
    // In the tabbed layout the card leaves the visible tab, so confirm where it went.
    if (window.matchMedia("(max-width: 1023px)").matches) {
      toast.show({ variant: "success", title: `Moved ${app.companyName} to ${status}` });
    }
  }

  async function handleDelete(app: JobApplication) {
    if (!confirm(`Delete application to ${app.companyName}?`)) return;
    remove.mutate(app.id);
  }

  // Empty board: show a centered onboarding hero instead of four tall empty
  // columns (which would push the only call-to-action below the fold). Ghost
  // status chips still hint at the kanban structure. Centers in the viewport on
  // lg (fills the remaining height) and ~55vh elsewhere.
  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center min-h-[55vh] lg:min-h-0 lg:flex-1 animate-fade-in">
        <div className="h-14 w-14 rounded-2xl bg-surface-subtle border border-border-subtle flex items-center justify-center mb-4">
          <LayoutGrid className="h-7 w-7 text-ink-muted" />
        </div>
        <h2 className="text-xl font-bold text-ink-primary">No applications yet</h2>
        <p className="text-sm text-ink-secondary mt-1.5 max-w-xs">
          Track your first application to start building your board.
        </p>
        <Button size="lg" className="mt-5" onClick={() => onAddInColumn("Applied")}>
          <Plus className="h-4 w-4" />
          New application
        </Button>
        <div className="flex items-center gap-x-4 gap-y-1.5 mt-8 flex-wrap justify-center">
          {STATUSES.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[s]}`} />
              {s}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragCancel={() => {
        setActiveId(null);
        setActiveDropStatus(null);
      }}
      onDragEnd={handleDragEnd}
    >
      {/* On lg the board fills the remaining height of the Dashboard's flex column
          so each column scrolls internally with its header pinned and the page
          itself never scrolls. Below lg only the selected tab's column renders
          and the page scrolls naturally. */}
      {/* Below lg (until all 4 columns fit): segmented status tabs, one column
          visible at a time. Sticky just under the 3.5rem app header; the negative
          margins match <main>'s side padding so the bar spans edge to edge. */}
      <div
        role="tablist"
        aria-label="Application status"
        className="lg:hidden sticky top-14 z-20 -mx-3 px-3 sm:-mx-6 sm:px-6 mb-3 py-2 bg-surface border-b border-border-subtle"
      >
        <div className="flex gap-1 p-1 rounded-lg bg-surface-subtle/60 border border-border-subtle">
          {STATUSES.map((status) => (
            <StatusTab
              key={status}
              status={status}
              count={grouped[status].length}
              selected={mobileStatus === status}
              isOver={activeId !== null && activeDropStatus === status}
              onSelect={() => setMobileStatus(status)}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 lg:flex-1 lg:min-h-0">
        {STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            applications={grouped[status]}
            activeDropStatus={activeDropStatus}
            hiddenOnMobile={status !== mobileStatus}
            onEdit={onEdit}
            onDelete={handleDelete}
            onView={onView}
            onMove={moveTo}
            onAdd={() => onAddInColumn(status)}
          />
        ))}
      </div>
      <DragOverlay>
        {activeApp ? (
          <div className="rotate-2">
            <ApplicationCard app={activeApp} onEdit={() => {}} onDelete={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
