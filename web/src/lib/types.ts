export type ApplicationStatus = "Applied" | "Interview" | "Offer" | "Rejected";

export const STATUSES: ApplicationStatus[] = [
  "Applied",
  "Interview",
  "Offer",
  "Rejected",
];

export type StatusChange = {
  status: ApplicationStatus;
  /** null = happened before the timeline existed; date unknown. */
  at: string | null;
};

export type JobApplication = {
  id: string;
  ownerId: string;
  companyName: string;
  position: string;
  jobLink?: string | null;
  jobDesc?: string | null;
  dateApplied?: string | null;
  status: ApplicationStatus;
  notes?: string | null;
  matchScore?: number | null;
  aiSummary?: string | null;
  /** Oldest first. */
  statusHistory: StatusChange[];
  createdAt: string;
};

export type JobApplicationInput = {
  companyName: string;
  position: string;
  jobLink?: string;
  jobDesc?: string;
  dateApplied?: string;
  status?: ApplicationStatus;
  notes?: string;
};

export type ReminderKind = "interview" | "follow_up" | "deadline" | "nudge" | "task";

export const REMINDER_KINDS: ReminderKind[] = [
  "interview",
  "follow_up",
  "deadline",
  "nudge",
  "task",
];

export const REMINDER_KIND_LABEL: Record<ReminderKind, string> = {
  interview: "Interview",
  follow_up: "Follow-up",
  deadline: "Deadline",
  nudge: "Nudge",
  task: "Task",
};

export type Reminder = {
  id: string;
  ownerId: string;
  text: string;
  kind: ReminderKind;
  dueAt?: string | null;
  endAt?: string | null;
  notes?: string | null;
  completed: boolean;
  orderIndex: number;
  applicationId?: string | null;
  nudgeId?: string | null;
  createdAt: string;
};

export type CalendarEvent = {
  id: string;
  source: "reminder" | "application";
  kind: ReminderKind | "application";
  title: string;
  start: string;
  end?: string | null;
  notes?: string | null;
  applicationId?: string | null;
  completed: boolean;
};

export type Nudge = {
  id: string;
  kind: ReminderKind;
  title: string;
  reason: string;
  suggestedDueAt: string;
  applicationId: string;
};

export type AnalyticsSummary = {
  total: number;
  byStatus: { status: ApplicationStatus; count: number }[];
  responseRate: number;
  weekly: { weekEnding: string; count: number }[];
  timing: {
    avgDaysToResponse: number | null;
    responsesMeasured: number;
    avgDaysInterviewToDecision: number | null;
    decisionsMeasured: number;
    noResponseCount: number;
    noResponseAfterDays: number;
  };
};

export type FunnelData = {
  stages: { label: string; count: number }[];
};
