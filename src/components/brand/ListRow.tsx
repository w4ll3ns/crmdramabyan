import { ChevronRight } from "lucide-react";
import { BrandAvatar } from "./Avatar";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function ListRow({
  title,
  subtitle,
  name,
  right,
  onClick,
  className,
}: {
  title: string;
  subtitle?: string;
  name?: string;
  right?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 min-h-[64px] rounded-2xl",
        "bg-card transition-colors active:bg-muted/60 text-left",
        className,
      )}
    >
      <BrandAvatar name={name ?? title} size={44} />
      <div className="flex-1 min-w-0">
        <div className="text-label text-foreground truncate">{title}</div>
        {subtitle ? (
          <div className="text-caption text-muted-foreground truncate">{subtitle}</div>
        ) : null}
      </div>
      {right}
      <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
    </button>
  );
}
