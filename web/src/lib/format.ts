import type { ApplicationStatus, ReminderKind } from "./types";

export const STATUS_COLORS: Record<ApplicationStatus, string> = {
  Applied: "bg-status-applied/15 text-status-applied border-status-applied/30",
  Interview: "bg-status-interview/15 text-status-interview border-status-interview/30",
  Offer: "bg-status-offer/15 text-status-offer border-status-offer/30",
  Rejected: "bg-status-rejected/15 text-status-rejected border-status-rejected/30",
};

export const STATUS_DOT: Record<ApplicationStatus, string> = {
  Applied: "bg-status-applied",
  Interview: "bg-status-interview",
  Offer: "bg-status-offer",
  Rejected: "bg-status-rejected",
};

// A bare "YYYY-MM-DD" (e.g. dateApplied) is a calendar day, not an instant.
// `new Date("2026-09-16")` would parse it as UTC midnight — the previous evening
// in the Americas — so build it as local midnight instead.
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDate(iso: string): Date {
  const m = DATE_ONLY.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
}

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function formatRelativeDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = parseDate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Count calendar days in the user's timezone, so anything from today reads "today".
  const days = Math.round((startOfLocalDay(new Date()) - startOfLocalDay(d)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return d.toLocaleDateString();
}

/** Today's date in the user's local timezone as YYYY-MM-DD. (`toISOString()` is
 *  UTC, which is already "tomorrow" on US evenings.) */
export function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Kind palette — distinct from STATUS palette so the eye can separate
// "what bucket is this app in" from "what type of reminder is this".
type KindKey = ReminderKind | "application";

export const KIND_COLORS: Record<KindKey, string> = {
  interview: "bg-status-interview/15 text-status-interview border-status-interview/30",
  follow_up: "bg-accent/15 text-accent border-accent/30",
  deadline: "bg-status-rejected/15 text-status-rejected border-status-rejected/30",
  nudge: "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30",
  task: "bg-surface-subtle text-ink-secondary border-border",
  application: "bg-status-applied/15 text-status-applied border-status-applied/30",
};

export const KIND_DOT: Record<KindKey, string> = {
  interview: "bg-status-interview",
  follow_up: "bg-accent",
  deadline: "bg-status-rejected",
  nudge: "bg-fuchsia-400",
  task: "bg-ink-muted",
  application: "bg-status-applied",
};

export const KIND_LABEL: Record<KindKey, string> = {
  interview: "Interview",
  follow_up: "Follow-up",
  deadline: "Deadline",
  nudge: "Nudge",
  task: "Task",
  application: "Applied",
};

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// Convert a JS Date to the value expected by <input type="datetime-local"> — local time, no Z.
export function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate()) +
    "T" +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes())
  );
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
