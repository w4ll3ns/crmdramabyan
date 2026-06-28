import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Check,
  CheckCircle2,
  XCircle,
  UserX,
  MessageCircle,
  Pencil,
  Loader2,
} from "lucide-react";
import { BottomSheet } from "@/components/brand/BottomSheet";
import { BrandAvatar } from "@/components/brand/Avatar";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  TIPO_LABEL,
  fmtDataLonga,
  fmtHora,
} from "@/lib/agenda";
import type { AgendamentoStatus } from "@/lib/agenda";
import {
  type AgendamentoFull,
  ensureConversation,
  useUpdateAgendamentoStatus,
} from "@/hooks/useAgenda";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function AgendamentoDetailSheet({
  open,
  onOpenChange,
  ag,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ag: AgendamentoFull | null;
  onEdit: (ag: AgendamentoFull) => void;
}) {
  const navigate = useNavigate();
  const update = useUpdateAgendamentoStatus();
  const [opening, setOpening] = useState(false);

  if (!ag) return null;

  const start = new Date(ag.data_hora);
  const nome = ag.paciente?.nome ?? "Paciente";
  const procNome = ag.procedimento?.nome ?? TIPO_LABEL[ag.tipo];

  async function changeStatus(s: AgendamentoStatus, confirmText?: string) {
    if (!ag) return;
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      await update.mutateAsync({
        id: ag.id,
        status: s,
        paciente_id: ag.paciente_id,
        procedimento_id: ag.procedimento_id,
        valor: ag.valor,
      });
      toast.success(`Status atualizado: ${STATUS_LABEL[s]}`);
      if (s === "realizado" || s === "cancelado") onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar");
    }
  }

  async function openConversa() {
    if (!ag?.paciente) {
      toast.error("Paciente sem dados de contato");
      return;
    }
    setOpening(true);
    try {
      const id = await ensureConversation(ag.paciente);
      if (!id) {
        toast.error("Paciente sem telefone cadastrado");
        return;
      }
      onOpenChange(false);
      navigate({
        to: "/app/conversas/$conversaId",
        params: { conversaId: id },
      });
    } finally {
      setOpening(false);
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <BrandAvatar name={nome} size={56} />
          <div className="flex-1 min-w-0">
            <div className="text-h2 truncate">{nome}</div>
            <div className="text-caption text-muted-foreground truncate">
              {procNome}
            </div>
          </div>
          <StatusBadge variant={STATUS_VARIANT[ag.status]}>
            {STATUS_LABEL[ag.status]}
          </StatusBadge>
        </div>

        <div className="rounded-2xl border border-border bg-muted/30 p-4 grid grid-cols-2 gap-y-3 gap-x-4">
          <Info label="Data">{fmtDataLonga(start)}</Info>
          <Info label="Hora">{fmtHora(start)}</Info>
          <Info label="Duração">{ag.duracao_minutos} min</Info>
          <Info label="Tipo">{TIPO_LABEL[ag.tipo]}</Info>
          {ag.valor != null && (
            <Info label="Valor">
              {Number(ag.valor).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </Info>
          )}
          {ag.profissional && <Info label="Profissional">{ag.profissional}</Info>}
        </div>

        {ag.observacoes && (
          <div className="rounded-2xl border border-border p-4">
            <div className="text-caption uppercase tracking-wide text-muted-foreground mb-1">
              Observações
            </div>
            <div className="text-label whitespace-pre-wrap">{ag.observacoes}</div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <ActionButton
            onClick={() => changeStatus("confirmado")}
            disabled={update.isPending || ag.status === "confirmado"}
            icon={<Check className="h-4 w-4" />}
            tone="info"
          >
            Confirmar
          </ActionButton>
          <ActionButton
            onClick={() => changeStatus("realizado")}
            disabled={update.isPending || ag.status === "realizado"}
            icon={<CheckCircle2 className="h-4 w-4" />}
            tone="success"
          >
            Realizado
          </ActionButton>
          <ActionButton
            onClick={() => changeStatus("faltou")}
            disabled={update.isPending || ag.status === "faltou"}
            icon={<UserX className="h-4 w-4" />}
            tone="warning"
          >
            Faltou
          </ActionButton>
          <ActionButton
            onClick={() =>
              changeStatus("cancelado", "Cancelar este agendamento?")
            }
            disabled={update.isPending || ag.status === "cancelado"}
            icon={<XCircle className="h-4 w-4" />}
            tone="danger"
          >
            Cancelar
          </ActionButton>
        </div>

        <Button
          onClick={openConversa}
          disabled={opening}
          className="w-full h-12 text-base gap-2"
        >
          {opening ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MessageCircle className="h-5 w-5" />
          )}
          Abrir conversa no WhatsApp
        </Button>

        <Button
          variant="outline"
          onClick={() => onEdit(ag)}
          className="w-full h-11 gap-2"
        >
          <Pencil className="h-4 w-4" />
          Editar agendamento
        </Button>
      </div>
    </BottomSheet>
  );
}

function Info({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-label">{children}</div>
    </div>
  );
}

function ActionButton({
  children,
  icon,
  tone,
  ...rest
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  tone: "info" | "success" | "warning" | "danger";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const tones: Record<typeof tone, string> = {
    info: "bg-primary/10 text-primary hover:bg-primary/20",
    success: "bg-success/15 text-success hover:bg-success/25",
    warning: "bg-warning/20 text-warning-foreground hover:bg-warning/30",
    danger: "bg-danger/15 text-danger hover:bg-danger/25",
  };
  return (
    <button
      {...rest}
      className={cn(
        "h-12 rounded-2xl flex items-center justify-center gap-2 text-label font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        tones[tone],
      )}
    >
      {icon}
      {children}
    </button>
  );
}
