import { AlertTriangle, Link2, Loader2, Sparkles, Type, X } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/Button";
import { Input, Label, Textarea } from "../../components/Input";
import { useToast } from "../../components/Toast";
import { useParseJob, type ParsedJob } from "./useParseJob";

type Props = {
  onApply: (parsed: ParsedJob) => void;
  defaultOpen?: boolean;
  dismissable?: boolean;
};

type Mode = "url" | "text";

const SOURCE_LABEL: Record<ParsedJob["source"], string> = {
  "json-ld": "Structured data found (high confidence)",
  opengraph: "Page metadata only (medium confidence)",
  fallback: "Heuristic extraction (low confidence)",
  text: "Parsed from pasted text",
};

const SOURCE_TINT: Record<ParsedJob["source"], string> = {
  "json-ld": "border-status-offer/40 bg-status-offer/5 text-status-offer",
  opengraph: "border-status-interview/40 bg-status-interview/5 text-status-interview",
  fallback: "border-status-rejected/40 bg-status-rejected/5 text-status-rejected",
  text: "border-accent/40 bg-accent/5 text-accent",
};

export function AutoFillPanel({ onApply, defaultOpen = false, dismissable = true }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const parse = useParseJob();
  const toast = useToast();

  function handleParse() {
    const args = mode === "url" ? { url: url.trim() } : { text: text.trim() };
    parse.mutate(args, {
      onError: (err) => {
        toast.show({
          variant: "error",
          title: "Couldn't parse",
          description: err instanceof Error ? err.message : "Try the other input mode.",
        });
      },
    });
  }

  function handleApply() {
    if (!parse.data) return;
    onApply(parse.data);
    toast.show({
      variant: "success",
      title: "Fields filled",
      description: "Review and edit before saving.",
    });
    if (dismissable) {
      setOpen(false);
      parse.reset();
      setUrl("");
      setText("");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 p-3 rounded-lg border border-dashed border-border bg-surface-elevated/30 hover:border-accent/50 hover:bg-accent/5 text-sm text-ink-secondary hover:text-ink-primary transition-colors"
      >
        <Sparkles className="h-4 w-4 text-accent" />
        Auto-fill from job posting URL or pasted text
      </button>
    );
  }

  const parsed = parse.data;

  return (
    <div className="rounded-lg border border-border bg-surface-elevated/50 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium">Auto-fill from a job posting</span>
        </div>
        {dismissable && (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              parse.reset();
            }}
            className="p-1 text-ink-muted hover:text-ink-primary rounded"
            aria-label="Close auto-fill"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex gap-1 p-1 bg-surface-subtle rounded-md w-fit text-xs">
        {(["url", "text"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
              mode === m
                ? "bg-surface-elevated text-ink-primary shadow-card"
                : "text-ink-secondary hover:text-ink-primary"
            }`}
          >
            {m === "url" ? <Link2 className="h-3 w-3" /> : <Type className="h-3 w-3" />}
            {m === "url" ? "URL" : "Pasted text"}
          </button>
        ))}
      </div>

      {mode === "url" ? (
        <div>
          <Label htmlFor="parse-url">Job posting URL</Label>
          <Input
            id="parse-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://boards.greenhouse.io/..."
          />
          <p className="text-xs text-ink-muted mt-1">
            Works best on Greenhouse, Lever, Workday, Indeed. LinkedIn blocks scrapers — use pasted text instead.
          </p>
        </div>
      ) : (
        <div>
          <Label htmlFor="parse-text">Paste the job description</Label>
          <Textarea
            id="parse-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the full job posting text here..."
            rows={5}
          />
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={handleParse}
          disabled={parse.isPending || (mode === "url" ? !url.trim() : !text.trim())}
        >
          {parse.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {parse.isPending ? "Parsing..." : "Parse"}
        </Button>
      </div>

      {parsed && (
        <div className="border-t border-border-subtle pt-3 space-y-2 animate-fade-in">
          <div className={`text-[11px] font-medium px-2 py-1 rounded border w-fit ${SOURCE_TINT[parsed.source]}`}>
            {SOURCE_LABEL[parsed.source]}
          </div>

          {parsed.warnings.length > 0 && (
            <div className="flex items-start gap-2 text-xs text-status-interview p-2 rounded border border-status-interview/30 bg-status-interview/5">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div>
                {parsed.warnings.map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
              </div>
            </div>
          )}

          <dl className="text-xs space-y-1">
            {parsed.companyName && (
              <div className="flex gap-2">
                <dt className="text-ink-muted w-16 sm:w-20 shrink-0">Company</dt>
                <dd className="text-ink-primary min-w-0 break-words">{parsed.companyName}</dd>
              </div>
            )}
            {parsed.position && (
              <div className="flex gap-2">
                <dt className="text-ink-muted w-16 sm:w-20 shrink-0">Position</dt>
                <dd className="text-ink-primary min-w-0 break-words">{parsed.position}</dd>
              </div>
            )}
            {parsed.notes && (
              <div className="flex gap-2">
                <dt className="text-ink-muted w-16 sm:w-20 shrink-0">Notes</dt>
                <dd className="text-ink-primary whitespace-pre-line min-w-0 break-words">{parsed.notes}</dd>
              </div>
            )}
          </dl>

          <div className="flex justify-end pt-1">
            <Button type="button" size="sm" onClick={handleApply}>
              Apply to form
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
