import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "../../lib/api";
import { getToken } from "../../lib/auth";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export type Resume = {
  content: string;
  fileName: string | null;
  uploadedAt: string;
  skills: string[];
};

export type MatchEntry = {
  score: number | null;
  matched: string[];
  missing: string[];
};

export type Matches = {
  hasResume: boolean;
  resumeSkills: string[];
  matches: Record<string, MatchEntry>;
};

const RESUME_KEY = ["resume"] as const;
const MATCHES_KEY = ["resume", "matches"] as const;

export function useResume() {
  return useQuery<Resume | null>({
    queryKey: RESUME_KEY,
    queryFn: () => apiFetch<Resume | null>("/api/resume"),
  });
}

export function useMatches() {
  return useQuery<Matches>({
    queryKey: MATCHES_KEY,
    queryFn: () => apiFetch<Matches>("/api/resume/matches"),
  });
}

export function useSaveResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { content: string; fileName?: string | null }) =>
      apiFetch<Resume>("/api/resume", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RESUME_KEY });
      qc.invalidateQueries({ queryKey: MATCHES_KEY });
    },
  });
}

export function useDeleteResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>("/api/resume", { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RESUME_KEY });
      qc.invalidateQueries({ queryKey: MATCHES_KEY });
    },
  });
}

// PDF upload uses multipart/form-data which apiFetch doesn't handle (it forces JSON).
// Drop down to a custom call with the auth header.
export function useUploadResume() {
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const token = getToken();
      const res = await fetch(`${BASE_URL}/api/resume/upload`, {
        method: "POST",
        body: fd,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        let detail: unknown = null;
        try {
          detail = await res.json();
        } catch {
          detail = await res.text().catch(() => null);
        }
        const message =
          (detail && typeof detail === "object" && "detail" in detail
            ? String((detail as { detail: unknown }).detail)
            : null) || `Upload failed: ${res.status}`;
        throw new ApiError(res.status, message, detail);
      }
      return (await res.json()) as { content: string; fileName: string | null };
    },
  });
}
