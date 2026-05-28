import { useEffect, useState } from "react";
import { useCurrentUser, useUpdateProfile } from "./auth";

export type Theme = "dark" | "light";

// localStorage is NOT the source of truth — it's only a render hint so we can
// apply the right theme before React mounts (avoiding a flash). The persisted
// source of truth is the user's `theme` field in the Atlas DB, which follows
// them across browsers and devices.
const CACHE_KEY = "hirearchy.theme";

export function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const cached = window.localStorage.getItem(CACHE_KEY);
  if (cached === "dark" || cached === "light") return cached;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    window.localStorage.setItem(CACHE_KEY, theme);
  } catch {
    // private mode / quota — the DB still holds the real preference.
  }
}

/**
 * Applies the logged-in user's saved theme (from the DB) whenever it loads or
 * changes. Mount once in the authenticated shell so a fresh login on any device
 * picks up the user's stored preference — even if they never open Settings.
 */
export function useApplyUserTheme(): void {
  const { data: user } = useCurrentUser();
  useEffect(() => {
    if (user?.theme === "dark" || user?.theme === "light") {
      applyTheme(user.theme);
    }
  }, [user?.theme]);
}

/**
 * Theme control for the Settings UI. Reads the current theme (DB value when
 * present, else the cached/OS default) and persists changes to the DB.
 */
export function useTheme(): { theme: Theme; set: (t: Theme) => void } {
  const { data: user } = useCurrentUser();
  const updateProfile = useUpdateProfile();
  const [theme, setLocal] = useState<Theme>(() =>
    user?.theme === "dark" || user?.theme === "light" ? user.theme : getInitialTheme(),
  );

  // Reconcile if the DB value arrives or changes (e.g. set on another device).
  useEffect(() => {
    if (user?.theme === "dark" || user?.theme === "light") {
      setLocal(user.theme);
    }
  }, [user?.theme]);

  const set = (t: Theme) => {
    setLocal(t); // instant UI feedback
    applyTheme(t); // instant class swap + cache update
    updateProfile.mutate({ theme: t }); // persist to Atlas
  };

  return { theme, set };
}
