import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import type { JobApplication, JobApplicationInput } from "../../lib/types";

const KEY = ["applications"] as const;

// Every dependent view that derives numbers from the applications collection.
// Invalidate all of them on every application mutation so stale stat boxes,
// funnels, charts, calendar markers, and nudges can't get out of sync with
// the board.
function invalidateDependents(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: KEY });
  qc.invalidateQueries({ queryKey: ["accountability", "summary"] });
  qc.invalidateQueries({ queryKey: ["resume", "matches"] });
  qc.invalidateQueries({ queryKey: ["analytics", "summary"] });
  qc.invalidateQueries({ queryKey: ["analytics", "funnel"] });
  qc.invalidateQueries({ queryKey: ["calendar", "events"] });
  qc.invalidateQueries({ queryKey: ["calendar", "nudges"] });
}

export function useApplications() {
  return useQuery<JobApplication[]>({
    queryKey: KEY,
    queryFn: () => apiFetch<JobApplication[]>("/api/applications"),
  });
}

export function useCreateApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: JobApplicationInput) =>
      apiFetch<JobApplication>("/api/applications", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateDependents(qc),
  });
}

export function useUpdateApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<JobApplication> }) =>
      apiFetch<JobApplication>(`/api/applications/${id}`, {
        method: "PUT",
        body: JSON.stringify(patch),
      }),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<JobApplication[]>(KEY);
      if (prev) {
        qc.setQueryData<JobApplication[]>(
          KEY,
          prev.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
    },
    onSettled: () => invalidateDependents(qc),
  });
}

export function useDeleteApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/applications/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateDependents(qc),
  });
}
