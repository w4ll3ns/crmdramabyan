import { cn } from "@/lib/utils";

export function BrandAvatar({
  name,
  size = 44,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-primary/15 text-foreground font-medium",
        "ring-2 ring-primary/30",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials || "·"}
    </div>
  );
}
