import { Monogram } from "./Monogram";
import { cn } from "@/lib/utils";

export function AppHeader({
  title = "Dra. Mabyan",
  subtitle = "Harmonização Facial",
  right,
  className,
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "surface-tint sticky top-0 z-30 pt-safe border-b border-border/60 backdrop-blur",
        className,
      )}
    >
      <div className="flex items-center gap-3 px-5 py-3">
        <Monogram size={40} />
        <div className="flex-1 min-w-0">
          <div className="text-h2 truncate">{title}</div>
          <div className="text-caption text-muted-foreground truncate">{subtitle}</div>
        </div>
        {right}
      </div>
    </header>
  );
}
