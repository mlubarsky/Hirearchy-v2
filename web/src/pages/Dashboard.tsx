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
} from "lucide-react";
import { useMemo, useState } from "react";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
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
  const [searchOpen, setSearchOpen] = useState(false);

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
    <div className="min-h-screen">
      <MilestoneWatcher />
      <nav className="sticky top-0 z-30 border-b border-border-subtle bg-surface/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center gap-2 sm:gap-3">
          {/* Left cluster — new application + search, board tab only */}
          {tab === "board" && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <button
                onClick={() => setAddingStatus("Applied")}
                aria-label="New application"
                className="group inline-flex items-center h-8 px-2 rounded-md bg-accent text-white hover:bg-accent-hover shadow-card text-sm font-medium overflow-hidden transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="max-w-0 opacity-0 group-hover:max-w-[10rem] group-hover:opacity-100 group-hover:ml-2 overflow-hidden whitespace-nowrap transition-all duration-200 ease-out">
                  New application
                </span>
              </button>
              {/* Mobile: search collapses to an icon next to + that toggles a
                  full-width search row below the controls. */}
              <button
                onClick={() => setSearchOpen((v) => !v)}
                aria-label="Search applications"
                aria-expanded={searchOpen}
                className={`sm:hidden p-2 rounded-lg transition-colors ${
                  searchOpen
                    ? "text-ink-primary bg-surface-elevated"
                    : "text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated"
                }`}
              >
                <Search className="h-4 w-4" />
              </button>
              <div className="relative flex-1 max-w-md hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search applications..."
                  className="pl-9"
                />
              </div>
            </div>
          )}

          {/* Right cluster — reminders, profile/settings, logout */}
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
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

        {/* Mobile-only full-width search row, revealed by the search icon */}
        {tab === "board" && searchOpen && (
          <div className="sm:hidden max-w-7xl mx-auto px-3 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search applications..."
                className="pl-9"
              />
            </div>
          </div>
        )}

        {/* Tab row: icon-only on mobile (tabs spread evenly to fill the width
            so they never overflow), icon + label at sm+. */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 -mb-px overflow-x-auto scrollbar-hide">
          <div className="flex gap-1 sm:min-w-max">
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                aria-label={label}
                title={label}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === key
                    ? "border-accent text-ink-primary"
                    : "border-transparent text-ink-secondary hover:text-ink-primary"
                }`}
              >
                <Icon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {stalledInterviews > 0 && tab === "board" && (
          <Card className="mb-4 p-3 border-status-interview/30 bg-status-interview/5 text-sm flex items-start sm:items-center gap-3 flex-wrap sm:flex-nowrap">
            <div className="h-2 w-2 mt-1.5 sm:mt-0 shrink-0 rounded-full bg-status-interview animate-pulse" />
            <span className="text-ink-primary flex-1">
              {stalledInterviews} interview{stalledInterviews === 1 ? "" : "s"} quiet for 2+ weeks
            </span>
            <span className="text-ink-muted text-xs sm:ml-auto">Consider a follow-up</span>
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
