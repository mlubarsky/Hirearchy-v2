import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import type { Reminder, ReminderKind } from "../../lib/types";

const KEY = ["reminders"] as const;
const ACCOUNTABILITY_KEY = ["accountability", "summary"] as const;

export function useReminders() {
  return useQuery<Reminder[]>({
    queryKey: KEY,
    queryFn: () => apiFetch<Reminder[]>("/api/reminders"),
  });
}

type CreateReminderInput = {
  text: string;
  kind?: ReminderKind;
  dueAt?: string;
  endAt?: string;
  notes?: string;
  applicationId?: string;
};

export function useCreateReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: CreateReminderInput) =>
      apiFetch<Reminder>("/api/reminders", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["calendar", "events"] });
      qc.invalidateQueries({ queryKey: ["calendar", "nudges"] });
      qc.invalidateQueries({ queryKey: ACCOUNTABILITY_KEY });
    },
  });
}

export function useUpdateReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Reminder> }) =>
      apiFetch<Reminder>(`/api/reminders/${id}`, {
        method: "PUT",
        body: JSON.stringify(patch),
      }),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<Reminder[]>(KEY);
      if (prev) {
        qc.setQueryData<Reminder[]>(
          KEY,
          prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["calendar", "events"] });
      qc.invalidateQueries({ queryKey: ACCOUNTABILITY_KEY });
    },
  });
}

export function useDeleteReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/reminders/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["calendar", "events"] });
      qc.invalidateQueries({ queryKey: ["calendar", "nudges"] });
    },
  });
}

export function useReorderReminders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { id: string; orderIndex: number }[]) =>
      apiFetch<void>("/api/reminders/reorder", {
        method: "PUT",
        body: JSON.stringify(items),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
