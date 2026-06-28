import { cn } from "@/lib/utils";

type Variant = "success" | "warning" | "danger" | "info" | "neutral";

const styles: Record<Variant, string> = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning-foreground",
  danger: "bg-danger/15 text-danger",
  info: "bg-primary/15 text-primary",
  neutral: "bg-muted text-muted-foreground",
};

export function StatusBadge({
  children,
  variant = "info",
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-caption font-medium",
        styles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
