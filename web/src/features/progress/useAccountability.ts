import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";

export type Milestone = {
  code: string;
  label: string;
  description: string;
  icon: string;
};

export type AccountabilitySummary = {
  xp: number;
  streak: number;
  longestStreak: number;
  weeklyTarget: number;
  weeklyCompleted: number;
  weekStart: string;
  totalApplications: number;
  byStatus: Record<string, number>;
  unlockedMilestones: string[];
  newlyUnlocked: string[];
  catalog: Milestone[];
};

const KEY = ["accountability", "summary"] as const;

export function useAccountabilitySummary() {
  return useQuery<AccountabilitySummary>({
    queryKey: KEY,
    queryFn: () => apiFetch<AccountabilitySummary>("/api/accountability/summary"),
  });
}

export function useUpdateWeeklyTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (weeklyTarget: number) =>
      apiFetch<AccountabilitySummary>("/api/accountability/settings", {
        method: "PUT",
        body: JSON.stringify({ weeklyTarget }),
      }),
    onSuccess: (data) => qc.setQueryData(KEY, data),
  });
}
