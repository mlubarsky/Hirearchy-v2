import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./api";

const TOKEN_KEY = "hirearchy.token";

export type User = {
  id: string;
  email: string;
  name: string | null;
  theme: "light" | "dark" | null;
};

type AuthResponse = {
  token: string;
  user: User;
};

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function useCurrentUser() {
  return useQuery<User | null>({
    queryKey: ["me"],
    queryFn: async () => {
      if (!getToken()) return null;
      try {
        return await apiFetch<User>("/api/auth/me");
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { email: string; password: string }) =>
      apiFetch<AuthResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: (data) => {
      setToken(data.token);
      qc.setQueryData(["me"], data.user);
    },
  });
}

export function useSignup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { email: string; password: string; name?: string }) =>
      apiFetch<AuthResponse>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: (data) => {
      setToken(data.token);
      qc.setQueryData(["me"], data.user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return () => {
    clearToken();
    qc.setQueryData(["me"], null);
    qc.clear();
  };
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { name?: string; theme?: "light" | "dark" }) =>
      apiFetch<User>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify(vars),
      }),
    onSuccess: (user) => {
      qc.setQueryData(["me"], user);
    },
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => apiFetch<void>("/api/auth/me", { method: "DELETE" }),
    onSuccess: () => {
      // Account is gone — drop the token and wipe all cached data so the app
      // falls back to the auth screen.
      clearToken();
      qc.setQueryData(["me"], null);
      qc.clear();
    },
  });
}
