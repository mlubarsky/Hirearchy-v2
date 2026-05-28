import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import type { CalendarEvent, Nudge, Reminder } from "../../lib/types";

const EVENTS_KEY = ["calendar", "events"] as const;
const NUDGES_KEY = ["calendar", "nudges"] as const;

export function useCalendarEvents(rangeFrom?: Date, rangeTo?: Date) {
  const params = new URLSearchParams();
  if (rangeFrom) params.set("from", rangeFrom.toISOString());
  if (rangeTo) params.set("to", rangeTo.toISOString());
  const qs = params.toString();
  return useQuery<CalendarEvent[]>({
    queryKey: [...EVENTS_KEY, qs],
    queryFn: () => apiFetch<CalendarEvent[]>(`/api/calendar/events${qs ? `?${qs}` : ""}`),
  });
}

export function useNudges() {
  return useQuery<Nudge[]>({
    queryKey: NUDGES_KEY,
    queryFn: () => apiFetch<Nudge[]>("/api/calendar/nudges"),
  });
}

export function useMaterializeNudge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nudge: Nudge) =>
      apiFetch<Reminder>("/api/reminders", {
        method: "POST",
        body: JSON.stringify({
          text: nudge.title,
          kind: nudge.kind,
          dueAt: nudge.suggestedDueAt,
          applicationId: nudge.applicationId,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders"] });
      qc.invalidateQueries({ queryKey: EVENTS_KEY });
      qc.invalidateQueries({ queryKey: NUDGES_KEY });
    },
  });
}
