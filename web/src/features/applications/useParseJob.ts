import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";

export type ParsedJob = {
  companyName?: string | null;
  position?: string | null;
  jobLink?: string | null;
  jobDesc?: string | null;
  notes?: string | null;
  source: "json-ld" | "opengraph" | "fallback" | "text";
  warnings: string[];
};

export function useParseJob() {
  return useMutation({
    mutationFn: (vars: { url?: string; text?: string }) =>
      apiFetch<ParsedJob>("/api/applications/parse", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
  });
}
