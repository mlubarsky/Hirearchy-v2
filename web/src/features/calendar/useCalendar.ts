import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiFetch } from "../../lib/api";
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
          nudgeId: nudge.id,
        }),
      }),
    // Remove the nudge right away so it can't be clicked twice while the list
    // refetches. The server also rejects a second copy (409).
    onMutate: async (nudge) => {
      await qc.cancelQueries({ queryKey: NUDGES_KEY });
      const prev = qc.getQueryData<Nudge[]>(NUDGES_KEY);
      qc.setQueryData<Nudge[]>(NUDGES_KEY, (list) => list?.filter((n) => n.id !== nudge.id));
      return { prev };
    },
    onError: (err, _nudge, ctx) => {
      // 409 = already added; keep it hidden. Anything else: put it back.
      if (!(err instanceof ApiError && err.status === 409) && ctx?.prev) {
        qc.setQueryData(NUDGES_KEY, ctx.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["reminders"] });
      qc.invalidateQueries({ queryKey: EVENTS_KEY });
      qc.invalidateQueries({ queryKey: NUDGES_KEY });
    },
  });
}
