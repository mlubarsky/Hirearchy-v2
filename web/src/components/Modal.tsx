import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
};

export function Modal({ open, onClose, title, children, maxWidth = "max-w-xl" }: Props) {
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
        className={`glass rounded-2xl shadow-elevated w-full ${maxWidth} animate-slide-up my-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border-subtle">
          <h2 className="text-base sm:text-lg font-semibold truncate pr-2">{title}</h2>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-md text-ink-muted hover:text-ink-primary hover:bg-surface-subtle transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 sm:px-6 py-4 sm:py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
