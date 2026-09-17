import {
  BarChart3,
  Bell,
  CalendarDays,
  FileText,
  LayoutGrid,
  LogOut,
  type LucideIcon,
  Plus,
  Search,
  Settings,
  Trophy,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Logo } from "../components/Logo";
import { Modal } from "../components/Modal";
import { AnalyticsPanel } from "../features/analytics/AnalyticsPanel";
import { ApplicationDetailModal } from "../features/applications/ApplicationDetailModal";
import { ApplicationForm } from "../features/applications/ApplicationForm";
import { KanbanBoard } from "../features/applications/KanbanBoard";
import {
  useApplications,
  useCreateApplication,
  useDeleteApplication,
  useUpdateApplication,
} from "../features/applications/useApplications";
import { CalendarView } from "../features/calendar/CalendarView";
import { MilestoneWatcher } from "../features/progress/MilestoneWatcher";
import { ProgressTab } from "../features/progress/ProgressTab";
import { RemindersPanel } from "../features/reminders/RemindersPanel";
import { ResumeTab } from "../features/resume/ResumeTab";
import { SettingsModal } from "../features/settings/SettingsModal";
import { useLogout } from "../lib/auth";
import { useApplyUserTheme } from "../lib/theme";
import type { ApplicationStatus, JobApplication } from "../lib/types";

type Tab = "board" | "calendar" | "progress" | "analytics" | "resume";

const STALLED_DISMISS_KEY = "hirearchy.stalledDismissed";

const TABS: { key: Tab; label: string; Icon: LucideIcon }[] = [
  { key: "board", label: "Board", Icon: LayoutGrid },
  { key: "calendar", label: "Calendar", Icon: CalendarDays },
  { key: "analytics", label: "Analytics", Icon: BarChart3 },
  { key: "resume", label: "Resume", Icon: FileText },
  { key: "progress", label: "Progress", Icon: Trophy },
];

export function Dashboard() {
  useApplyUserTheme();
  const logout = useLogout();
  const { data: apps = [], isLoading } = useApplications();
  const create = useCreateApplication();
  const update = useUpdateApplication();
  const remove = useDeleteApplication();

  const [tab, setTab] = useState<Tab>("board");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<JobApplication | null>(null);
  const [viewing, setViewing] = useState<JobApplication | null>(null);
  const [addingStatus, setAddingStatus] = useState<ApplicationStatus | null>(null);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stalledDismissed, setStalledDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STALLED_DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  function dismissStalled() {
    setStalledDismissed(true);
    try {
      localStorage.setItem(STALLED_DISMISS_KEY, "1");
    } catch {
      // private mode / quota — state still hides it for the session.
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return apps;
    return apps.filter((a) =>
      [a.companyName, a.position, a.status, a.notes, a.jobLink, a.jobDesc]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [apps, search]);

  const stalledInterviews = useMemo(() => {
    const cutoff = Date.now() - 14 * 86_400_000;
    return apps.filter(
      (a) => a.status === "Interview" && new Date(a.createdAt).getTime() < cutoff,
    ).length;
  }, [apps]);

  return (
    // On lg the board tab is a fixed-viewport flex column: the board takes the
    // leftover height and its columns scroll internally, so the page never scrolls.
    <div className={`min-h-screen ${tab === "board" ? "lg:h-screen lg:flex lg:flex-col" : ""}`}>
      <MilestoneWatcher />
      {/* Single header row, identical on every tab: logo · tabs · account icons.
          Tab-specific controls (e.g. the board's add/search) live in the page
          content, so the header never has an empty gap. */}
      <nav className="sticky top-0 z-30 shrink-0 border-b border-border-subtle bg-surface/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-stretch gap-2 sm:gap-6">
          <div className="hidden sm:flex items-center shrink-0">
            <Logo size={26} />
          </div>

          {/* Tabs: icon-only below md (spread evenly on mobile), icon + label at
              md+. Full row height so the active underline sits on the
              header's bottom border. */}
          <div className="flex flex-1 sm:flex-none gap-1 -mb-px min-w-0 overflow-x-auto scrollbar-hide">
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                aria-label={label}
                title={label}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === key
                    ? "border-accent text-ink-primary"
                    : "border-transparent text-ink-secondary hover:text-ink-primary"
                }`}
              >
                <Icon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                <span className="hidden md:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Right cluster — reminders, profile/settings, logout */}
          <div className="ml-auto flex items-center gap-0.5 sm:gap-2 shrink-0">
            <button
              onClick={() => setRemindersOpen(true)}
              className="p-2 rounded-lg text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated transition-colors"
              aria-label="Reminders"
            >
              <Bell className="h-4 w-4" />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-lg text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated transition-colors"
              aria-label="Profile and settings"
              title="Profile & settings"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              onClick={logout}
              className="p-2 rounded-lg text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated transition-colors"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </nav>

      <main
        className={`w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 ${
          tab === "board" ? "lg:flex-1 lg:min-h-0 lg:flex lg:flex-col" : ""
        }`}
      >
        {/* Board toolbar — search + new application */}
        {tab === "board" && (
          <div className="mb-4 shrink-0 flex items-center gap-2">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search applications..."
                aria-label="Search applications"
                className="pl-9"
              />
            </div>
            <Button
              onClick={() => setAddingStatus("Applied")}
              aria-label="New application"
              title="New application"
              className="ml-auto shrink-0 px-3 sm:px-4"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New application</span>
            </Button>
          </div>
        )}

        {stalledInterviews > 0 && tab === "board" && !stalledDismissed && (
          <Card className="mb-4 shrink-0 p-3 border-status-interview/30 bg-status-interview/5 text-sm flex items-start sm:items-center gap-3 flex-wrap sm:flex-nowrap">
            <div className="h-2 w-2 mt-1.5 sm:mt-0 shrink-0 rounded-full bg-status-interview animate-pulse" />
            <span className="text-ink-primary flex-1">
              {stalledInterviews} interview{stalledInterviews === 1 ? "" : "s"} quiet for 2+ weeks
            </span>
            <span className="text-ink-muted text-xs sm:ml-auto">Consider a follow-up</span>
            <button
              onClick={dismissStalled}
              aria-label="Dismiss notification"
              title="Dismiss"
              className="shrink-0 h-5 w-5 inline-flex items-center justify-center rounded-full bg-ink-muted/15 text-ink-muted hover:bg-ink-muted/25 hover:text-ink-primary transition-colors"
            >
              <X className="h-3 w-3" strokeWidth={2.5} />
            </button>
          </Card>
        )}

        {tab === "board" && (
          <>
            {isLoading ? (
              <div className="text-center py-12 text-ink-muted">Loading...</div>
            ) : (
              <KanbanBoard
                applications={filtered}
                onEdit={(app) => setEditing(app)}
                onView={(app) => setViewing(app)}
                onAddInColumn={(status) => setAddingStatus(status)}
              />
            )}
          </>
        )}
        {tab === "calendar" && <CalendarView />}
        {tab === "progress" && <ProgressTab />}
        {tab === "analytics" && <AnalyticsPanel />}
        {tab === "resume" && <ResumeTab />}
      </main>

      <Modal
        open={addingStatus !== null}
        onClose={() => setAddingStatus(null)}
        title="New application"
      >
        {addingStatus !== null && (
          <ApplicationForm
            initial={{ status: addingStatus } as JobApplication}
            onSubmit={async (data) => {
              await create.mutateAsync({ ...data, status: addingStatus });
              setAddingStatus(null);
            }}
            onCancel={() => setAddingStatus(null)}
            submitLabel="Add application"
          />
        )}
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit application"
      >
        {editing && (
          <ApplicationForm
            initial={editing}
            onSubmit={async (data) => {
              await update.mutateAsync({ id: editing.id, patch: data });
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
            submitLabel="Save changes"
          />
        )}
      </Modal>

      <Modal
        open={remindersOpen}
        onClose={() => setRemindersOpen(false)}
        title="Reminders"
        maxWidth="max-w-md"
      >
        <RemindersPanel />
      </Modal>

      <ApplicationDetailModal
        app={viewing}
        onClose={() => setViewing(null)}
        onEdit={(app) => {
          setViewing(null);
          setEditing(app);
        }}
        onDelete={(app) => {
          if (!confirm(`Delete application to ${app.companyName}?`)) return;
          // Close any open modal immediately on confirm — don't wait on the
          // network call, and clear both view + edit state so nothing lingers.
          setViewing(null);
          setEditing(null);
          remove.mutate(app.id);
        }}
      />

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
