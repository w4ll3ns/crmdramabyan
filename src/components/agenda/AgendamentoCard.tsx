import { BrandAvatar } from "@/components/brand/Avatar";
import { StatusBadge } from "@/components/brand/StatusBadge";
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  TIPO_LABEL,
  fmtHora,
} from "@/lib/agenda";
import type { AgendamentoFull } from "@/hooks/useAgenda";
import { cn } from "@/lib/utils";

export function AgendamentoCard({
  ag,
  onClick,
  compact = false,
}: {
  ag: AgendamentoFull;
  onClick?: () => void;
  compact?: boolean;
}) {
  const start = new Date(ag.data_hora);
  const nome = ag.paciente?.nome ?? "Paciente";
  const procNome = ag.procedimento?.nome ?? TIPO_LABEL[ag.tipo];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-2xl border border-border bg-card px-4 py-3",
        "flex items-center gap-3 transition-colors hover:bg-muted/40 active:bg-muted/60",
        compact ? "min-h-[64px]" : "min-h-[72px]",
      )}
    >
      <div className="flex flex-col items-center justify-center w-12 shrink-0">
        <span className="text-base font-semibold tabular-nums leading-none">
          {fmtHora(start)}
        </span>
        <span className="text-[10px] text-muted-foreground mt-1">
          {ag.duracao_minutos} min
        </span>
      </div>
      <BrandAvatar name={nome} size={compact ? 36 : 40} />
      <div className="flex-1 min-w-0">
        <div className="text-label font-medium truncate">{nome}</div>
        <div className="text-caption text-muted-foreground truncate">
          {procNome}
        </div>
      </div>
      <StatusBadge variant={STATUS_VARIANT[ag.status]} className="shrink-0">
        {STATUS_LABEL[ag.status]}
      </StatusBadge>
    </button>
  );
}
