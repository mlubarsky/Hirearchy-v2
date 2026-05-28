import { useEffect, useRef } from "react";
import { useMilestoneCelebration } from "../../components/MilestoneCelebration";
import { useAccountabilitySummary } from "./useAccountability";

/**
 * Watches the accountability summary across the whole app (not just the Progress
 * tab) and fires a celebration when a milestone is newly unlocked.
 *
 * We diff the *persistent* `unlockedMilestones` list against a baseline captured
 * on the first load of the session — NOT the server's transient `newlyUnlocked`
 * field. `newlyUnlocked` is consume-once (the backend clears it after the first
 * GET), so a duplicate refetch (which happens constantly when a mutation
 * invalidates several queries at once) would race and swallow the celebration.
 * `unlockedMilestones` always holds the complete set, so diffing it is immune to
 * that race.
 *
 * Mount once near the top of the authenticated tree.
 */
export function MilestoneWatcher() {
  const { data } = useAccountabilitySummary();
  const { celebrate } = useMilestoneCelebration();
  // null until the first summary arrives; then holds every code we've accounted
  // for (either pre-existing at load, or already celebrated this session).
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!data) return;
    const unlocked = data.unlockedMilestones ?? [];

    // First summary of the session: establish the baseline silently so we don't
    // re-celebrate milestones the user already earned in a previous session.
    if (seen.current === null) {
      seen.current = new Set(unlocked);
      return;
    }

    // Any milestone now present that we haven't accounted for is genuinely new.
    for (const code of unlocked) {
      if (seen.current.has(code)) continue;
      seen.current.add(code);
      const meta = data.catalog.find((m) => m.code === code);
      if (meta) {
        celebrate({
          code: meta.code,
          label: meta.label,
          description: meta.description,
          icon: meta.icon,
        });
      }
    }
  }, [data, celebrate]);

  return null;
}
