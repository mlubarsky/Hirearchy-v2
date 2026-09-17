import {
  Award,
  CalendarCheck,
  CalendarHeart,
  Flame,
  Rocket,
  Sparkles,
  Target,
  Trophy,
  Users,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ConfettiBurst } from "./Confetti";

const ICON_MAP: Record<string, LucideIcon> = {
  rocket: Rocket,
  flame: Flame,
  target: Target,
  trophy: Trophy,
  users: Users,
  award: Award,
  "calendar-check": CalendarCheck,
  "calendar-heart": CalendarHeart,
  zap: Zap,
};

export type MilestoneCelebrationInput = {
  code: string;
  label: string;
  description: string;
  icon: string;
};

type Internal = MilestoneCelebrationInput & { uid: number };

type ContextValue = {
  celebrate: (m: MilestoneCelebrationInput) => void;
};

const CelebrationContext = createContext<ContextValue | null>(null);

const SHOW_MS = 3500;
const EXIT_MS = 400;

export function MilestoneCelebrationProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Internal[]>([]);
  const [current, setCurrent] = useState<Internal | null>(null);
  const [exiting, setExiting] = useState(false);

  const celebrate = useCallback((m: MilestoneCelebrationInput) => {
    setQueue((prev) => [...prev, { ...m, uid: Date.now() + Math.random() }]);
  }, []);

  // Pull the next item off the queue whenever we're idle.
  useEffect(() => {
    if (current !== null || queue.length === 0) return;
    setCurrent(queue[0]);
    setQueue((q) => q.slice(1));
    setExiting(false);
  }, [current, queue]);

  // Auto-dismiss: hold for SHOW_MS, then play exit, then clear.
  useEffect(() => {
    if (!current) return;
    const t1 = window.setTimeout(() => setExiting(true), SHOW_MS);
    const t2 = window.setTimeout(() => setCurrent(null), SHOW_MS + EXIT_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [current]);

  const dismiss = useCallback(() => {
    setExiting(true);
    window.setTimeout(() => setCurrent(null), EXIT_MS);
  }, []);

  return (
    <CelebrationContext.Provider value={{ celebrate }}>
      {children}
      {current && <CelebrationCard key={current.uid} milestone={current} exiting={exiting} onDismiss={dismiss} />}
    </CelebrationContext.Provider>
  );
}

function CelebrationCard({
  milestone,
  exiting,
  onDismiss,
}: {
  milestone: Internal;
  exiting: boolean;
  onDismiss: () => void;
}) {
  const Icon = ICON_MAP[milestone.icon] ?? Trophy;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-3 left-1/2 z-[200] -translate-x-1/2 pointer-events-none ${
        exiting ? "animate-milestone-exit" : "animate-milestone-enter"
      }`}
    >
      {/* Confetti bursts from the card's center. Lives outside the card so the
          card's overflow-hidden (for the accent wash) doesn't clip the pieces.
          Only render while entering so it fires once. */}
      {!exiting && <ConfettiBurst />}

      <div className="glass pointer-events-auto rounded-2xl shadow-elevated px-3 py-2.5 sm:px-4 sm:py-3 flex items-center gap-3 max-w-[calc(100vw-1.5rem)] sm:max-w-md relative overflow-hidden">
        {/* soft accent wash behind the card */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-accent/10 via-transparent to-status-offer/15" />

        <div className="relative shrink-0 h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-brand-grad-br flex items-center justify-center animate-milestone-icon shadow-[0_0_20px_-2px_rgb(var(--accent)/0.5)]">
          <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-accent-fg" />
          <Sparkles className="absolute -top-1 -right-1 h-3 w-3 text-accent animate-milestone-sparkle" />
          <Sparkles
            className="absolute -bottom-1 -left-1 h-2.5 w-2.5 text-status-offer animate-milestone-sparkle"
            style={{ animationDelay: "0.6s" }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.15em] font-bold text-accent">
            Milestone unlocked
          </div>
          <div className="text-sm sm:text-base font-bold text-ink-primary truncate">
            {milestone.label}
          </div>
          <div className="text-[11px] sm:text-xs text-ink-secondary line-clamp-1">
            {milestone.description}
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="shrink-0 p-1 rounded text-ink-muted hover:text-ink-primary transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function useMilestoneCelebration(): ContextValue {
  const ctx = useContext(CelebrationContext);
  if (!ctx) {
    throw new Error("useMilestoneCelebration must be used within MilestoneCelebrationProvider");
  }
  return ctx;
}
