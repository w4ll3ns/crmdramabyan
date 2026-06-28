import { useEffect, useMemo, useRef } from "react";
import { addDays, fmtDiaCurto, isSameDay, isoDay, startOfDay } from "@/lib/agenda";
import { cn } from "@/lib/utils";

export function DayStrip({
  selected,
  onChange,
  countsByIso,
  range = 14,
}: {
  selected: Date;
  onChange: (d: Date) => void;
  countsByIso?: Record<string, number>;
  range?: number;
}) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const days = useMemo(
    () =>
      Array.from({ length: range * 2 + 1 }, (_, i) => addDays(today, i - range)),
    [today, range],
  );
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [selected]);

  return (
    <div
      ref={scrollerRef}
      className="flex gap-2 overflow-x-auto px-4 pb-3 -mx-4 scroll-px-4 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Selecionar dia"
    >
      {days.map((d) => {
        const active = isSameDay(d, selected);
        const isToday = isSameDay(d, today);
        const { dow, num } = fmtDiaCurto(d);
        const cnt = countsByIso?.[isoDay(d)] ?? 0;
        return (
          <button
            key={d.toISOString()}
            ref={active ? selectedRef : null}
            role="tab"
            aria-selected={active}
            aria-pressed={active}
            onClick={() => onChange(d)}
            className={cn(
              "snap-start shrink-0 flex flex-col items-center justify-center w-14 h-[72px] rounded-2xl border transition-all duration-200",
              active
                ? "bg-primary text-primary-foreground border-primary shadow-soft"
                : "bg-card border-border text-foreground hover:bg-muted",
            )}
          >
            <span
              className={cn(
                "text-[10px] uppercase tracking-wide font-medium",
                active
                  ? "text-primary-foreground/90"
                  : isToday
                    ? "text-primary"
                    : "text-muted-foreground",
              )}
            >
              {dow}
            </span>
            <span className="text-xl font-semibold tabular-nums leading-tight">
              {num}
            </span>
            <span
              className={cn(
                "mt-0.5 h-1 w-1 rounded-full",
                cnt > 0
                  ? active
                    ? "bg-primary-foreground"
                    : "bg-primary"
                  : "bg-transparent",
              )}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}
