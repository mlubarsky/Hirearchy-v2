import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
  /** Pinned below the scrollable body (e.g. action buttons). */
  footer?: React.ReactNode;
  /**
   * Give the dialog a fixed height that fits the viewport (capped on tall
   * screens) and scroll the body inside it, so the page never scrolls. A
   * minimum height keeps it usable on very short screens — below that, the
   * overlay scrolls instead.
   */
  fixedHeight?: boolean;
};

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-xl",
  footer,
  fixedHeight = false,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  // Portal to <body> so the overlay is always viewport-sized. Without this, a
  // modal opened from inside another modal gets trapped: the parent's `.glass`
  // backdrop-filter makes it the containing block for `position: fixed`, so a
  // nested modal would size itself to the parent box instead of the screen.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-8 overflow-y-auto bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`glass rounded-2xl shadow-elevated w-full ${maxWidth} animate-slide-up my-auto ${
          fixedHeight
            ? "flex flex-col h-[calc(100dvh-1.5rem)] sm:h-[calc(100dvh-4rem)] max-h-[48rem] min-h-[24rem]"
            : ""
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border-subtle">
          <h2 className="text-base sm:text-lg font-semibold truncate pr-2">{title}</h2>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-md text-ink-muted hover:text-ink-primary hover:bg-surface-subtle transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div
          className={`px-4 sm:px-6 py-4 sm:py-5 ${fixedHeight ? "flex-1 min-h-0 overflow-y-auto" : ""}`}
        >
          {children}
        </div>
        {footer && (
          <div className="shrink-0 px-4 sm:px-6 py-3 border-t border-border-subtle">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
