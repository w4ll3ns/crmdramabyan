import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center px-8 py-12 gap-3">
      <div className="h-16 w-16 rounded-full bg-primary/12 flex items-center justify-center text-primary">
        {icon ?? (
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12h8M12 8v8" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <div className="text-h2">{title}</div>
      {description ? (
        <p className="text-caption text-muted-foreground max-w-xs">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
