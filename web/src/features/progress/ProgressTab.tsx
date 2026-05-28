import {
  Award,
  Calendar,
  CalendarCheck,
  CalendarHeart,
  Check,
  Flame,
  Lock,
  Pencil,
  Rocket,
  Target,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Input } from "../../components/Input";
import { useToast } from "../../components/Toast";
import {
  useAccountabilitySummary,
  useUpdateWeeklyTarget,
  type Milestone,
} from "./useAccountability";

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

const PRETTY_MILESTONE_LABEL: Record<string, string> = {
  first_application: "First application",
  five_applications: "5 applications",
  twenty_five_applications: "25 applications",
  hundred_applications: "100 applications",
  first_interview: "First interview",
  first_offer: "First offer",
  seven_day_streak: "7-day streak",
  thirty_day_streak: "30-day streak",
  goal_crusher: "Goal crusher",
};

function StatCard({
  label,
  value,
  hint,
  Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  Icon: LucideIcon;
  tone?: "default" | "accent" | "fire";
}) {
  const toneClass =
    tone === "accent"
      ? "from-accent/20 to-transparent border-accent/30"
      : tone === "fire"
        ? "from-status-interview/20 to-transparent border-status-interview/30"
        : "from-surface-subtle to-transparent border-border-subtle";
  return (
    <Card className={`p-4 bg-gradient-to-br ${toneClass}`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs uppercase tracking-wider text-ink-muted">{label}</span>
        <Icon className="h-4 w-4 text-ink-muted" />
      </div>
      <div className="text-3xl font-bold text-ink-primary">{value}</div>
      {hint && <div className="text-xs text-ink-muted mt-1">{hint}</div>}
    </Card>
  );
}

function MilestoneCard({ m, unlocked }: { m: Milestone; unlocked: boolean }) {
  const Icon = ICON_MAP[m.icon] ?? Trophy;
  return (
    <div
      className={`relative flex items-start gap-3 p-3 rounded-lg border transition-colors ${
        unlocked
          ? "border-accent/40 bg-accent/5"
          : "border-border-subtle bg-surface-elevated/30 opacity-60"
      }`}
    >
      <div
        className={`shrink-0 h-10 w-10 rounded-lg flex items-center justify-center ${
          unlocked ? "bg-brand-grad-br text-white" : "bg-surface-subtle text-ink-muted"
        }`}
      >
        {unlocked ? <Icon className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-ink-primary">{m.label}</div>
        <div className="text-xs text-ink-secondary mt-0.5">{m.description}</div>
      </div>
      {unlocked && (
        <div className="absolute top-2 right-2">
          <Check className="h-3.5 w-3.5 text-status-offer" />
        </div>
      )}
    </div>
  );
}

function WeeklyTargetEditor({
  current,
  onSave,
  saving,
}: {
  current: number;
  onSave: (value: number) => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(current));

  useEffect(() => {
    setValue(String(current));
  }, [current]);

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 text-xs text-ink-secondary hover:text-ink-primary"
        title="Edit weekly target"
      >
        <Pencil className="h-3 w-3" />
        Edit target
      </button>
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    onSave(parsed);
    setEditing(false);
  }

  return (
    <form onSubmit={handleSubmit} className="inline-flex items-center gap-2">
      <Input
        type="number"
        min={0}
        max={200}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-16 h-7 px-2 text-xs"
        autoFocus
      />
      <Button type="submit" size="sm" disabled={saving}>
        Save
      </Button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-xs text-ink-muted hover:text-ink-primary"
      >
        Cancel
      </button>
    </form>
  );
}

export function ProgressTab() {
  const { data, isLoading } = useAccountabilitySummary();
  const updateTarget = useUpdateWeeklyTarget();
  const toast = useToast();

  // Milestone unlock celebrations are now handled globally by <MilestoneWatcher />.
  // We leave the toast import for the weekly-target-saved success message below.

  if (isLoading || !data) {
    return <div className="text-ink-muted text-sm">Loading progress...</div>;
  }

  const weeklyPct =
    data.weeklyTarget > 0
      ? Math.min(100, Math.round((data.weeklyCompleted / data.weeklyTarget) * 100))
      : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Streak"
          value={`${data.streak}d`}
          hint={data.longestStreak > data.streak ? `Best: ${data.longestStreak}d` : "Keep it going"}
          Icon={Flame}
          tone="fire"
        />
        <StatCard label="XP" value={data.xp.toLocaleString()} hint="Earned across your hunt" Icon={Zap} tone="accent" />
        <StatCard
          label="Applications"
          value={data.totalApplications}
          hint="Total tracked"
          Icon={Target}
        />
        <StatCard
          label="Milestones"
          value={`${data.unlockedMilestones.length} / ${data.catalog.length}`}
          hint="Unlocked"
          Icon={Trophy}
        />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold">Weekly goal</div>
            <div className="text-xs text-ink-muted mt-0.5">
              Week of {new Date(data.weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </div>
          </div>
          <WeeklyTargetEditor
            current={data.weeklyTarget}
            saving={updateTarget.isPending}
            onSave={(value) => {
              updateTarget.mutate(value, {
                onSuccess: () => toast.show({ variant: "success", title: "Weekly target updated" }),
              });
            }}
          />
        </div>
        <div className="flex items-end justify-between mb-2">
          <div className="text-2xl font-bold">
            {data.weeklyCompleted}
            <span className="text-ink-muted text-base"> / {data.weeklyTarget}</span>
          </div>
          <div className="text-xs text-ink-secondary">{weeklyPct}% complete</div>
        </div>
        <div className="h-2 bg-surface-subtle rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-grad-r transition-all duration-500"
            style={{ width: `${weeklyPct}%` }}
          />
        </div>
        {data.weeklyCompleted >= data.weeklyTarget && data.weeklyTarget > 0 && (
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-status-offer">
            <Zap className="h-3.5 w-3.5" />
            You hit your target. 🎯
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold">Milestones</h3>
          <span className="text-xs text-ink-muted">
            {data.unlockedMilestones.length} / {data.catalog.length}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.catalog.map((m) => (
            <MilestoneCard
              key={m.code}
              m={m}
              unlocked={data.unlockedMilestones.includes(m.code)}
            />
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-ink-muted" />
          <h3 className="text-sm font-semibold">How XP is earned</h3>
        </div>
        <ul className="text-xs text-ink-secondary space-y-1.5">
          <li>
            <span className="font-mono text-ink-primary">+10</span> per application created
          </li>
          <li>
            <span className="font-mono text-ink-primary">+25</span> bonus when an application reaches Interview
          </li>
          <li>
            <span className="font-mono text-ink-primary">+100</span> bonus when an application reaches Offer
          </li>
          <li>
            <span className="font-mono text-ink-primary">+5</span> per completed reminder
          </li>
        </ul>
      </Card>
    </div>
  );
}
