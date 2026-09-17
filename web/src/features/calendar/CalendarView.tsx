import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { KIND_DOT, KIND_LABEL, formatTime, isSameDay } from "../../lib/format";
import type { CalendarEvent, JobApplication } from "../../lib/types";
import { useApplications } from "../applications/useApplications";
import { EventModal } from "./EventModal";
import { NudgesPanel } from "./NudgesPanel";
import { useCalendarEvents } from "./useCalendar";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfCalendarGrid(d: Date): Date {
  const start = startOfMonth(d);
  const dow = start.getDay();
  return new Date(start.getFullYear(), start.getMonth(), 1 - dow);
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function CalendarView() {
  const today = new Date();
  const [cursor, setCursor] = useState(startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [modalEvent, setModalEvent] = useState<CalendarEvent | null>(null);
  const [creating, setCreating] = useState<Date | null>(null);

  // Query a generous range covering the full visible grid (~42 days).
  const gridStart = useMemo(() => startOfCalendarGrid(cursor), [cursor]);
  const gridEnd = useMemo(() => addDays(gridStart, 42), [gridStart]);

  const { data: events = [] } = useCalendarEvents(gridStart, gridEnd);
  const { data: applications = [] } = useApplications();

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = new Date(e.start).toDateString();
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return map;
  }, [events]);

  const selectedEvents = eventsByDay.get(selectedDate.toDateString()) ?? [];

  const days: Date[] = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < 42; i++) out.push(addDays(gridStart, i));
    return out;
  }, [gridStart]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      <Card className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2 flex-wrap">
          <h2 className="text-base sm:text-lg font-semibold">
            {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCursor(addMonths(cursor, -1))}
              className="p-1.5 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-subtle transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setCursor(startOfMonth(today));
                setSelectedDate(today);
              }}
              className="px-2.5 py-1 text-xs font-medium text-ink-secondary hover:text-ink-primary hover:bg-surface-subtle rounded transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => setCursor(addMonths(cursor, 1))}
              className="p-1.5 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-subtle transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <Button size="sm" className="ml-2" onClick={() => setCreating(selectedDate)} aria-label="New event">
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New event</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 mb-1 text-xs font-medium text-ink-muted">
          {WEEKDAYS.map((w) => (
            <div key={w} className="px-2 py-1 text-center">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const dayEvents = eventsByDay.get(d.toDateString()) ?? [];
            const inMonth = d.getMonth() === cursor.getMonth();
            const isToday = isSameDay(d, today);
            const isSelected = isSameDay(d, selectedDate);

            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelectedDate(d)}
                onDoubleClick={() => setCreating(d)}
                className={`group min-h-[56px] sm:min-h-[88px] flex flex-col items-stretch rounded-md sm:rounded-lg border p-1 sm:p-1.5 text-left transition-colors ${
                  isSelected
                    ? "border-accent bg-accent/5"
                    : "border-border-subtle hover:border-border bg-surface-elevated/40"
                } ${!inMonth ? "opacity-40" : ""}`}
              >
                <div
                  className={`text-[11px] sm:text-xs mb-1 flex items-center justify-between ${
                    isToday ? "text-accent font-semibold" : "text-ink-secondary"
                  }`}
                >
                  <span
                    className={
                      isToday
                        ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-fg text-[10px]"
                        : ""
                    }
                  >
                    {d.getDate()}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="text-[10px] text-ink-muted hidden sm:inline">
                      {dayEvents.length}
                    </span>
                  )}
                </div>

                {/* Mobile: just colored dots, no text — there's no room and the agenda
                    panel below the calendar shows the details for the selected day. */}
                <div className="sm:hidden flex flex-wrap gap-0.5 mt-auto">
                  {dayEvents.slice(0, 4).map((e) => (
                    <span
                      key={e.id}
                      className={`h-1.5 w-1.5 rounded-full ${KIND_DOT[e.kind]} ${e.completed ? "opacity-40" : ""}`}
                      title={e.title}
                    />
                  ))}
                  {dayEvents.length > 4 && (
                    <span className="text-[9px] text-ink-muted leading-none">+{dayEvents.length - 4}</span>
                  )}
                </div>

                <div className="hidden sm:block space-y-0.5 overflow-hidden">
                  {dayEvents.slice(0, 3).map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center gap-1 text-[11px] leading-tight truncate"
                      title={e.title}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full shrink-0 ${KIND_DOT[e.kind]}`}
                      />
                      <span
                        className={`truncate ${e.completed ? "line-through text-ink-muted" : "text-ink-primary"}`}
                      >
                        {e.title}
                      </span>
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-ink-muted pl-2.5">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <Card className="p-4 flex flex-col min-h-0 lg:h-80">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">
              {selectedDate.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h3>
            <button
              onClick={() => setCreating(selectedDate)}
              className="p-1 rounded text-ink-muted hover:text-ink-primary hover:bg-surface-subtle"
              aria-label="Add event"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {selectedEvents.length === 0 ? (
            <p className="text-xs text-ink-muted py-2">Nothing scheduled.</p>
          ) : (
            <ul className="space-y-2 max-h-[280px] lg:max-h-none lg:flex-1 min-h-0 overflow-y-auto -mr-1 pr-1">
              {selectedEvents.map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => setModalEvent(e)}
                    className="w-full text-left p-2 rounded-md bg-surface-subtle/40 border border-border-subtle hover:border-border transition-colors"
                  >
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-ink-muted mb-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${KIND_DOT[e.kind]}`} />
                      {KIND_LABEL[e.kind]}
                      {/* Application markers are all-day (no real time) — only
                          scheduled reminders/events show a time. */}
                      {e.source === "reminder" && (
                        <span className="ml-auto normal-case tracking-normal text-ink-secondary">
                          {formatTime(e.start)}
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-sm ${e.completed ? "line-through text-ink-muted" : "text-ink-primary"}`}
                    >
                      {e.title}
                    </div>
                    {e.notes && (
                      <div className="text-xs text-ink-secondary mt-1 line-clamp-2">{e.notes}</div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <NudgesPanel />
      </div>

      <EventModal
        open={modalEvent !== null || creating !== null}
        onClose={() => {
          setModalEvent(null);
          setCreating(null);
        }}
        event={modalEvent}
        defaultDate={creating}
        applications={applications as JobApplication[]}
      />
    </div>
  );
}
