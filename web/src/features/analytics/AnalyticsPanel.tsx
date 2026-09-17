import { useQuery } from "@tanstack/react-query";
import { ArrowDown } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "../../components/Card";
import { apiFetch } from "../../lib/api";
import type { AnalyticsSummary, ApplicationStatus, FunnelData } from "../../lib/types";

const STATUS_FILL: Record<ApplicationStatus, string> = {
  Applied: "rgb(var(--status-applied))",
  Interview: "rgb(var(--status-interview))",
  Offer: "rgb(var(--status-offer))",
  Rejected: "rgb(var(--status-rejected))",
};

// Recharts inlines styles, so it can't pick up Tailwind classes — we have to hand it
// theme-aware colors via CSS variables (defined in index.css for both themes).
const tooltipContentStyle: React.CSSProperties = {
  background: "var(--c-surface-elevated)",
  border: "1px solid var(--c-border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--c-ink-primary)",
  boxShadow: "0 4px 16px rgb(0 0 0 / 0.12)",
};

const tooltipItemStyle: React.CSSProperties = { color: "var(--c-ink-primary)" };
const tooltipLabelStyle: React.CSSProperties = {
  color: "var(--c-ink-secondary)",
  marginBottom: 4,
};

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wider text-ink-muted mb-1">{label}</div>
      <div className="text-2xl font-semibold text-accent">{value}</div>
      {hint && <div className="text-xs text-ink-muted mt-1">{hint}</div>}
    </Card>
  );
}

function formatDays(days: number | null): string {
  if (days === null) return "—";
  return `${days} ${days === 1 ? "day" : "days"}`;
}

function measuredHint(count: number, noun: string): string {
  if (count === 0) return `no dated ${noun}s yet`;
  return `avg across ${count} ${noun}${count === 1 ? "" : "s"}`;
}

const FUNNEL_TINT = [
  { fill: "from-status-applied/30 to-status-applied/10", text: "text-status-applied" },
  { fill: "from-status-interview/30 to-status-interview/10", text: "text-status-interview" },
  { fill: "from-status-offer/30 to-status-offer/10", text: "text-status-offer" },
];

const FUNNEL_WIDTHS = ["w-full", "w-[80%]", "w-[60%]"];

function FunnelStage({
  label,
  count,
  pctOfTotal,
  widthClass,
  tint,
}: {
  label: string;
  count: number;
  pctOfTotal: number;
  widthClass: string;
  tint: (typeof FUNNEL_TINT)[number];
}) {
  return (
    <div className={`${widthClass} mx-auto`}>
      <div
        className={`rounded-xl border border-border-subtle bg-gradient-to-b ${tint.fill} px-4 py-3 flex items-center justify-between`}
      >
        <div>
          <div className={`text-xs font-semibold uppercase tracking-wider ${tint.text}`}>
            {label}
          </div>
          <div className="text-2xl font-bold text-ink-primary mt-0.5">{count}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-ink-muted">
            of applied
          </div>
          <div className="text-sm font-semibold text-ink-primary">{pctOfTotal}%</div>
        </div>
      </div>
    </div>
  );
}

function ConversionArrow({ rate, gone }: { rate: number; gone: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-1.5">
      <ArrowDown className="h-3.5 w-3.5 text-ink-muted" />
      <div className="text-[11px] text-ink-secondary">
        <span className="font-semibold text-ink-primary">{rate}%</span>
        <span className="text-ink-muted"> converted</span>
        {gone > 0 && (
          <span className="text-ink-muted">
            {" "}
            · {gone} dropped off
          </span>
        )}
      </div>
    </div>
  );
}

export function AnalyticsPanel() {
  const summary = useQuery<AnalyticsSummary>({
    queryKey: ["analytics", "summary"],
    queryFn: () => apiFetch<AnalyticsSummary>("/api/analytics/summary"),
  });
  const funnel = useQuery<FunnelData>({
    queryKey: ["analytics", "funnel"],
    queryFn: () => apiFetch<FunnelData>("/api/analytics/funnel"),
  });

  if (summary.isLoading || funnel.isLoading) {
    return <div className="text-ink-muted text-sm">Loading analytics...</div>;
  }
  if (!summary.data || !funnel.data) return null;

  const s = summary.data;
  const offerCount = s.byStatus.find((b) => b.status === "Offer")?.count ?? 0;
  const interviewCount = s.byStatus.find((b) => b.status === "Interview")?.count ?? 0;

  const stages = funnel.data.stages; // [Applied, Interview, Offer]
  const total = stages[0]?.count ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total" value={s.total} hint="applications tracked" />
        <Stat label="Interviews" value={interviewCount} />
        <Stat label="Offers" value={offerCount} />
        <Stat label="Response rate" value={`${s.responseRate}%`} />
      </div>

      {/* Timing — from each application's status timeline */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat
          label="Time to response"
          value={formatDays(s.timing.avgDaysToResponse)}
          hint={measuredHint(s.timing.responsesMeasured, "response")}
        />
        <Stat
          label="Interview → decision"
          value={formatDays(s.timing.avgDaysInterviewToDecision)}
          hint={measuredHint(s.timing.decisionsMeasured, "decision")}
        />
        <Stat
          label="No response"
          value={s.timing.noResponseCount}
          hint={`still Applied after ${s.timing.noResponseAfterDays}+ days`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-sm font-medium mb-3">Applications per week</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={s.weekly} margin={{ left: -20, right: 0, top: 8 }}>
              <defs>
                <linearGradient id="weekly" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--c-accent)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--c-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--c-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="weekEnding"
                tickFormatter={(v) => v.slice(5)}
                stroke="var(--c-ink-muted)"
                fontSize={11}
              />
              <YAxis stroke="var(--c-ink-muted)" fontSize={11} allowDecimals={false} />
              <Tooltip
                contentStyle={tooltipContentStyle}
                itemStyle={tooltipItemStyle}
                labelStyle={tooltipLabelStyle}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--c-accent)"
                strokeWidth={2}
                fill="url(#weekly)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-medium mb-3">Status breakdown</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={s.byStatus} margin={{ left: -20, right: 0, top: 8 }}>
              <CartesianGrid stroke="var(--c-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="status" stroke="var(--c-ink-muted)" fontSize={11} />
              <YAxis stroke="var(--c-ink-muted)" fontSize={11} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "rgb(var(--accent) / 0.08)" }}
                contentStyle={tooltipContentStyle}
                itemStyle={tooltipItemStyle}
                labelStyle={tooltipLabelStyle}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {s.byStatus.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_FILL[entry.status]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold">Funnel</div>
            <div className="text-xs text-ink-muted mt-0.5">
              Where your applications currently sit.
            </div>
          </div>
          {total > 0 && (
            <div className="text-xs text-ink-secondary">
              <span className="font-semibold text-ink-primary">
                {Math.round((stages[stages.length - 1]?.count ?? 0) / total * 100)}%
              </span> currently at offer
            </div>
          )}
        </div>

        {total === 0 ? (
          <div className="text-sm text-ink-muted text-center py-6">
            No applications yet. Funnel will populate as you add them.
          </div>
        ) : (
          <div className="space-y-1">
            {stages.map((stage, i) => {
              const pctOfTotal = total ? Math.round((stage.count / total) * 100) : 0;
              const prev = i > 0 ? stages[i - 1].count : null;
              const conversion =
                prev !== null && prev > 0 ? Math.round((stage.count / prev) * 100) : null;
              const dropped = prev !== null ? Math.max(0, prev - stage.count) : 0;

              return (
                <div key={stage.label}>
                  {conversion !== null && (
                    <ConversionArrow rate={conversion} gone={dropped} />
                  )}
                  <FunnelStage
                    label={stage.label}
                    count={stage.count}
                    pctOfTotal={pctOfTotal}
                    widthClass={FUNNEL_WIDTHS[i] ?? "w-full"}
                    tint={FUNNEL_TINT[i] ?? FUNNEL_TINT[0]}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
