import { cn } from "@/lib/utils";

export function Monogram({ className, size = 40 }: { className?: string; size?: number }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span
        style={{ fontFamily: "var(--font-serif)", fontSize: size * 0.55, lineHeight: 1 }}
        className="font-bold"
      >
        M
      </span>
    </div>
  );
}
