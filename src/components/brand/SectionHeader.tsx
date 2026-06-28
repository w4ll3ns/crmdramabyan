import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeader({
  title,
  action,
  className,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky top-[64px] z-10 bg-background/85 backdrop-blur",
        "flex items-center justify-between px-5 py-3",
        className,
      )}
    >
      <h2 className="text-h2 text-foreground">{title}</h2>
      {action}
    </div>
  );
}
