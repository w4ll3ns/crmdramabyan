import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Calendar as CalendarIcon } from "lucide-react";
import { EmptyState } from "@/components/brand/EmptyState";
import { SegmentedControl } from "@/components/brand/SegmentedControl";
import { Fab } from "@/components/brand/Fab";
import { DayStrip } from "@/components/agenda/DayStrip";
import { AgendamentoCard } from "@/components/agenda/AgendamentoCard";
import { AgendamentoSheet } from "@/components/agenda/AgendamentoSheet";
import { AgendamentoDetailSheet } from "@/components/agenda/AgendamentoDetailSheet";
import {
  type AgendamentoFull,
  useAgendamentosRange,
  useAConfirmarHojeCount,
} from "@/hooks/useAgenda";
import {
  addDays,
  endOfDay,
  fmtDataLonga,
  fmtDiaCurto,
  isSameDay,
  isoDay,
  startOfDay,
  startOfWeek,
} from "@/lib/agenda";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/agenda")({
  component: AgendaPage,
});

type Modo = "dia" | "semana";

function AgendaPage() {
  const [modo, setModo] = useState<Modo>("dia");
  const [selected, setSelected] = useState<Date>(() => startOfDay(new Date()));
  const today = useMemo(() => startOfDay(new Date()), []);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AgendamentoFull | null>(null);
  const [detail, setDetail] = useState<AgendamentoFull | null>(null);

  // Range: dia mostra selected; semana mostra a semana de selected.
  const { from, to } = useMemo(() => {
    if (modo === "dia") {
      return { from: startOfDay(selected), to: endOfDay(selected) };
    }
    const weekStart = startOfWeek(selected);
    return { from: weekStart, to: endOfDay(addDays(weekStart, 6)) };
  }, [modo, selected]);

  // Para o ponto indicador na faixa, busca um range amplo (±14d) — barato.
  const stripRange = useMemo(
    () => ({
      from: startOfDay(addDays(today, -14)),
      to: endOfDay(addDays(today, 14)),
    }),
    [today],
  );
  const stripQuery = useAgendamentosRange(stripRange.from, stripRange.to);
  const countsByIso = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of stripQuery.data ?? []) {
      const k = isoDay(new Date(a.data_hora));
      map[k] = (map[k] ?? 0) + 1;
    }
    return map;
  }, [stripQuery.data]);

  const query = useAgendamentosRange(from, to);
  const items = query.data ?? [];

  const isToday = isSameDay(selected, today);

  return (
    <div className="pb-6">
      <div className="sticky top-[64px] z-20 bg-background/95 backdrop-blur border-b border-border/60 px-4 pt-3">
        <div className="flex items-center justify-between gap-2">
          <SegmentedControl<Modo>
            value={modo}
            onChange={setModo}
            options={[
              { label: "Dia", value: "dia" },
              { label: "Semana", value: "semana" },
            ]}
          />
          {!isToday && (
            <button
              type="button"
              onClick={() => setSelected(today)}
              className="text-caption font-medium text-primary inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              Hoje
            </button>
          )}
        </div>
        <ConfirmarHojePill />

        <div className="pt-3">
          <DayStrip
            selected={selected}
            onChange={setSelected}
            countsByIso={countsByIso}
          />
        </div>
      </div>

      {modo === "dia" ? (
        <DiaView
          date={selected}
          items={items}
          loading={query.isLoading}
          onSelect={(a) => setDetail(a)}
        />
      ) : (
        <SemanaView
          weekStart={startOfWeek(selected)}
          items={items}
          onSelect={(a) => setDetail(a)}
          onPickDay={(d) => {
            setSelected(d);
            setModo("dia");
          }}
        />
      )}

      <div className="fixed right-5 bottom-[88px] z-40 mb-safe">
        <Fab onClick={() => setCreateOpen(true)} aria-label="Novo agendamento">
          <Plus className="h-6 w-6" />
        </Fab>
      </div>

      <AgendamentoSheet
        open={createOpen || !!editing}
        onOpenChange={(v) => {
          if (!v) {
            setCreateOpen(false);
            setEditing(null);
          }
        }}
        initial={editing}
        defaultDate={selected}
      />

      <AgendamentoDetailSheet
        open={!!detail}
        onOpenChange={(v) => !v && setDetail(null)}
        ag={detail}
        onEdit={(a) => {
          setDetail(null);
          setEditing(a);
        }}
      />
    </div>
  );
}

function ConfirmarHojePill() {
  const n = useAConfirmarHojeCount();
  if (!n) return null;
  return (
    <div className="mt-2 pb-2">
      <span className="inline-flex items-center gap-2 text-caption px-3 py-1 rounded-full bg-warning/15 text-warning-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-warning" />
        {n} a confirmar hoje
      </span>
    </div>
  );
}

function DiaView({
  date,
  items,
  loading,
  onSelect,
}: {
  date: Date;
  items: AgendamentoFull[];
  loading: boolean;
  onSelect: (a: AgendamentoFull) => void;
}) {
  if (loading && items.length === 0) {
    return (
      <div className="px-4 pt-6 text-center text-caption text-muted-foreground">
        Carregando…
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="pt-10 px-4">
        <EmptyState
          icon={<CalendarIcon className="h-7 w-7" strokeWidth={1.5} />}
          title="Nenhum agendamento"
          description={`Nada agendado para ${fmtDataLonga(date)}.`}
        />
      </div>
    );
  }
  // Agrupar por hora cheia para os headers de slot
  const groups: { hour: number; items: AgendamentoFull[] }[] = [];
  for (const a of items) {
    const h = new Date(a.data_hora).getHours();
    const last = groups[groups.length - 1];
    if (last && last.hour === h) last.items.push(a);
    else groups.push({ hour: h, items: [a] });
  }
  return (
    <div className="px-4 pt-4 flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g.hour} className="flex flex-col gap-2">
          <div className="text-caption text-muted-foreground font-medium tabular-nums">
            {String(g.hour).padStart(2, "0")}:00
          </div>
          {g.items.map((a) => (
            <AgendamentoCard key={a.id} ag={a} onClick={() => onSelect(a)} />
          ))}
        </div>
      ))}
    </div>
  );
}

function SemanaView({
  weekStart,
  items,
  onSelect,
  onPickDay,
}: {
  weekStart: Date;
  items: AgendamentoFull[];
  onSelect: (a: AgendamentoFull) => void;
  onPickDay: (d: Date) => void;
}) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return (
    <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 px-4 pt-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {days.map((d) => {
        const dayItems = items.filter((a) =>
          isSameDay(new Date(a.data_hora), d),
        );
        const isTodayCol = isSameDay(d, today);
        const { dow, num } = fmtDiaCurto(d);
        return (
          <div
            key={d.toISOString()}
            className="snap-start shrink-0 w-[85vw] sm:w-[320px] flex flex-col gap-2"
          >
            <button
              type="button"
              onClick={() => onPickDay(d)}
              className={cn(
                "flex items-baseline justify-between rounded-2xl px-3 py-2 border",
                isTodayCol
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-card border-border",
              )}
            >
              <span className="text-label font-semibold uppercase">{dow}</span>
              <span className="text-2xl font-semibold tabular-nums">{num}</span>
            </button>
            {dayItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card px-3 py-6 text-center text-caption text-muted-foreground">
                Sem agendamentos
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {dayItems.map((a) => (
                  <AgendamentoCard
                    key={a.id}
                    ag={a}
                    compact
                    onClick={() => onSelect(a)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
