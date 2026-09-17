import {
  AlertCircle,
  Check,
  FileText,
  Loader2,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Textarea } from "../../components/Input";
import { useToast } from "../../components/Toast";
import { useApplications } from "../applications/useApplications";
import {
  useDeleteResume,
  useMatches,
  useResume,
  useSaveResume,
  useUploadResume,
} from "./useResume";

const MAX_CHARS = 50_000;

function SkillChip({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "matched" | "missing";
}) {
  const cls =
    tone === "matched"
      ? "bg-status-offer/15 text-status-offer border-status-offer/30"
      : tone === "missing"
        ? "bg-status-rejected/10 text-status-rejected border-status-rejected/30"
        : "bg-surface-subtle text-ink-secondary border-border-subtle";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cls}`}>
      {label}
    </span>
  );
}

export function ResumeTab() {
  const { data: resume } = useResume();
  const { data: matchData } = useMatches();
  const { data: applications = [] } = useApplications();
  const save = useSaveResume();
  const upload = useUploadResume();
  const del = useDeleteResume();
  const toast = useToast();

  const fileInput = useRef<HTMLInputElement | null>(null);
  const [content, setContent] = useState(resume?.content ?? "");
  const [fileName, setFileName] = useState<string | null>(resume?.fileName ?? null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setContent(resume?.content ?? "");
    setFileName(resume?.fileName ?? null);
  }, [resume?.content, resume?.fileName]);

  const dirty = content !== (resume?.content ?? "");

  async function handleFile(file: File) {
    try {
      const data = await upload.mutateAsync(file);
      setContent(data.content);
      setFileName(data.fileName);
      toast.show({
        variant: "info",
        title: "PDF extracted",
        description: "Review the text and click Save when ready.",
      });
    } catch (err) {
      toast.show({
        variant: "error",
        title: "Couldn't read this PDF",
        description: err instanceof Error ? err.message : "Try pasting the text instead.",
      });
    }
  }

  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = ""; // allow re-uploading the same file
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  async function handleSave() {
    if (!content.trim()) return;
    try {
      await save.mutateAsync({ content: content.trim(), fileName });
      toast.show({ variant: "success", title: "Resume saved" });
    } catch (err) {
      toast.show({
        variant: "error",
        title: "Save failed",
        description: err instanceof Error ? err.message : "Try again.",
      });
    }
  }

  async function handleDelete() {
    if (!confirm("Delete your resume? Match scores will disappear from your cards.")) return;
    await del.mutateAsync();
    setContent("");
    setFileName(null);
    toast.show({ variant: "info", title: "Resume removed" });
  }

  // Build a sortable, joinable list of {app, match} for the right-column results.
  const matchedApps = applications
    .map((app) => ({
      app,
      match: matchData?.matches?.[app.id] ?? null,
    }))
    .filter((row) => row.match && row.match.score !== null)
    .sort((a, b) => (b.match!.score ?? 0) - (a.match!.score ?? 0));

  const skills = resume?.skills ?? [];

  return (
    <div className="space-y-4">
      <div>
        {/* relative + z-10 so the skills tray below reads as tucked underneath */}
        <Card className="relative z-10 p-4">
          <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold inline-flex items-center gap-2">
                <FileText className="h-4 w-4 text-accent" />
                Your resume
              </div>
              <div className="text-xs text-ink-muted mt-0.5">
                We use it to score how well each application matches your background.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf"
                onChange={handleFileInput}
                className="hidden"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInput.current?.click()}
                disabled={upload.isPending}
              >
                {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {upload.isPending ? "Reading..." : "Upload PDF"}
              </Button>
              {resume && (
                <Button type="button" variant="danger" size="sm" onClick={handleDelete}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              )}
            </div>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`rounded-lg border-2 border-dashed transition-colors ${
              dragOver ? "border-accent bg-accent/5" : "border-border-subtle"
            }`}
          >
            <Textarea
              id="resume-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                "Paste the contents of your resume or upload a PDF. You can also just type keywords and skills into the box."
              }
              rows={12}
              maxLength={MAX_CHARS}
              className="!border-0 !rounded-md focus:!ring-0"
            />
          </div>

          <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
            <div className="text-xs text-ink-muted">
              {content.length.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
              {fileName && <> · from {fileName}</>}
            </div>
            <div className="flex items-center gap-2">
              {dirty && (
                <span className="text-xs text-status-interview inline-flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Unsaved
                </span>
              )}
              <Button size="sm" onClick={handleSave} disabled={!content.trim() || !dirty || save.isPending}>
                {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {save.isPending ? "Saving..." : "Save resume"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Skills tray — stitched to the bottom of the resume card: inset a little,
            recessed page-colored background, no top border, and a dashed seam. */}
        {resume && skills.length > 0 && (
          <div className="relative mx-3 sm:mx-5 -mt-px rounded-b-xl border border-t-0 border-border-subtle bg-surface px-4 pt-3.5 pb-3">
            <div
              aria-hidden
              className="absolute inset-x-3 top-0 border-t border-dashed border-border"
            />
            <div className="text-xs font-medium text-ink-secondary mb-2.5 inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Skills detected ({skills.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <SkillChip key={s} label={s} />
              ))}
            </div>
          </div>
        )}
      </div>

      {resume && (
        <Card className="p-4">
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-sm font-semibold">Matches</div>
            {matchedApps.length > 4 && (
              <div className="text-[11px] text-ink-muted">
                {matchedApps.length} applications · scroll for more
              </div>
            )}
          </div>
          {matchedApps.length === 0 ? (
            <p className="text-xs text-ink-muted">
              No applications have a job description yet — add descriptions to see match scores.
            </p>
          ) : (
            <ul className="divide-y divide-border-subtle max-h-[28rem] overflow-y-auto pr-1 -mr-1">
              {matchedApps.map(({ app, match }) => (
                <li key={app.id} className="py-3">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink-primary truncate">
                        {app.companyName}
                      </div>
                      <div className="text-xs text-ink-secondary truncate">{app.position}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-ink-primary">{match!.score}%</div>
                      <div className="text-[10px] uppercase tracking-wider text-ink-muted">
                        match
                      </div>
                    </div>
                  </div>
                  <div className="relative h-1.5 bg-surface-subtle rounded-full overflow-hidden mb-2">
                    <div
                      className="absolute inset-0 bg-gradient-to-r from-status-rejected via-status-interview to-status-offer transition-[clip-path] duration-500"
                      style={{
                        clipPath: `inset(0 ${100 - Math.min(100, Math.max(0, match!.score ?? 0))}% 0 0)`,
                      }}
                    />
                  </div>
                  {match!.matched.length > 0 && (
                    <div className="flex items-start gap-2 text-[11px] mb-1">
                      <Check className="h-3 w-3 text-status-offer mt-0.5 shrink-0" />
                      <div className="flex flex-wrap gap-1">
                        {match!.matched.map((s) => (
                          <SkillChip key={s} label={s} tone="matched" />
                        ))}
                      </div>
                    </div>
                  )}
                  {match!.missing.length > 0 && (
                    <div className="flex items-start gap-2 text-[11px]">
                      <AlertCircle className="h-3 w-3 text-status-rejected mt-0.5 shrink-0" />
                      <div className="flex flex-wrap gap-1">
                        {match!.missing.map((s) => (
                          <SkillChip key={s} label={s} tone="missing" />
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
