import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Chip({
  children,
  active,
  onClick,
  className,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 px-4 py-2 rounded-full text-label transition-all duration-200",
        active
          ? "bg-primary text-primary-foreground shadow-soft"
          : "bg-card text-foreground border border-border hover:border-primary/40",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 overflow-x-auto px-5 py-2 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  );
}
