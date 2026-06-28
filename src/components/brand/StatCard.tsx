import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl bg-card shadow-soft p-5 flex flex-col gap-2",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-caption text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        {Icon ? (
          <span className="h-8 w-8 rounded-full bg-primary/12 flex items-center justify-center text-primary">
            <Icon className="h-4 w-4" strokeWidth={1.5} />
          </span>
        ) : null}
      </div>
      <div className="text-display text-foreground">{value}</div>
      {hint ? <div className="text-caption text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
