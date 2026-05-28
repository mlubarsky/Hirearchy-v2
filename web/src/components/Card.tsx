import { clsx } from "clsx";

export function Card({
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "bg-surface-elevated border border-border-subtle rounded-xl shadow-card",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
