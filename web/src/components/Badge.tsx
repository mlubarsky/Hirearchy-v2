import { clsx } from "clsx";
import { STATUS_COLORS, STATUS_DOT } from "../lib/format";
import type { ApplicationStatus } from "../lib/types";

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
        STATUS_COLORS[status],
      )}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
      {status}
    </span>
  );
}
