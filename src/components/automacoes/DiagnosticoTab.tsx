import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  PauseCircle,
} from "lucide-react";
import { useDiagnostico } from "@/hooks/useDiagnostico";
import { useSetRegua } from "@/hooks/useReguas";
import { toast } from "sonner";

type Level = "ok" | "warn" | "fail";

function Row({
  level,
  title,
  desc,
  action,
}: {
  level: Level;
  title: string;
  desc?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const Icon =
    level === "ok" ? CheckCircle2 : level === "warn" ? AlertTriangle : XCircle;
  const color =
    level === "ok"
      ? "text-success"
      : level === "warn"
        ? "text-warning"
        : "text-destructive";
  return (
    <div className="rounded-2xl bg-card shadow-soft p-4 flex items-start gap-3">
      <Icon className={`h-5 w-5 mt-0.5 ${color}`} strokeWidth={1.5} />
      <div className="flex-1 min-w-0">
        <div className="text-label">{title}</div>
        {desc ? (
          <div className="text-caption text-muted-foreground mt-0.5">
            {desc}
          </div>
        ) : null}
      </div>
      {action}
    </div>
  );
}

const TIPOS_LABEL: Record<string, string> = {
  confirmacao: "Confirmação",
  lembrete: "Lembrete",
  pos_procedimento: "Pós-procedimento",
  retorno: "Retorno",
  recall: "Recall",
  aniversario: "Aniversário",
  reativacao: "Reativação",
  no_show: "No-show",
};

function fmtBRT(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function DiagnosticoTab() {
  const { data, isLoading, refetch, isFetching } = useDiagnostico();
  const qc = useQueryClient();
  const setRegua = useSetRegua();

  if (isLoading || !data) {
    return (
      <div className="text-caption text-muted-foreground">Carregando…</div>
    );
  }

  const tiposSemModelo = Object.entries(data.modelosAtivosPorTipo)
    .filter(([, n]) => n === 0)
    .map(([t]) => TIPOS_LABEL[t] ?? t);

  const cronAtivo = data.cron.find((c) => c.active);
  const ultimaExec = cronAtivo?.last_start
    ? new Date(cronAtivo.last_start)
    : null;
  const cronRecente =
    ultimaExec && Date.now() - ultimaExec.getTime() < 5 * 60_000;
  const cronStatus = cronAtivo?.last_status ?? null;

  const retomar = async () => {
    try {
      await setRegua.mutateAsync({
        chave: "automacoes_pausa_auto",
        valor: { ativo: false, desde: null, motivo: null },
      });
      toast.success("Automações retomadas");
      qc.invalidateQueries({ queryKey: ["automacoes", "diagnostico"] });
    } catch (e) {
      toast.error("Falha ao retomar", { description: (e as Error).message });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-caption text-muted-foreground">
          Atualiza a cada 30s.
        </p>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-8 px-3 rounded-lg text-caption inline-flex items-center gap-1 hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
          />
          Re-checar
        </button>
      </div>

      <Row
        level={data.pausado ? "fail" : "ok"}
        title="Pausa global"
        desc={
          data.pausado
            ? "Automações estão pausadas em Configurações › Réguas."
            : "Automações ativas."
        }
      />

      <Row
        level={data.pausaAuto.ativo ? "fail" : "ok"}
        title="Pausa automática (shadowban)"
        desc={
          data.pausaAuto.ativo ? (
            <>
              Pausada desde{" "}
              {data.pausaAuto.desde ? fmtBRT(data.pausaAuto.desde) : "—"}
              {data.pausaAuto.motivo ? ` · ${data.pausaAuto.motivo}` : ""}
            </>
          ) : (
            "Sem detecção de bloqueio."
          )
        }
        action={
          data.pausaAuto.ativo ? (
            <button
              onClick={retomar}
              className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-caption inline-flex items-center gap-1"
            >
              <PauseCircle className="h-3.5 w-3.5" /> Retomar
            </button>
          ) : null
        }
      />

      <Row
        level={data.zapi.conectada ? "ok" : "fail"}
        title="WhatsApp (Z-API)"
        desc={
          data.zapi.conectada
            ? "Instância conectada."
            : `Status: ${data.zapi.status ?? "sem instância"}. Conecte em Configurações › WhatsApp.`
        }
      />

      <Row
        level={tiposSemModelo.length === 0 ? "ok" : "warn"}
        title="Modelos de mensagem"
        desc={
          tiposSemModelo.length === 0
            ? "Todos os tipos automáticos têm pelo menos uma variante ativa."
            : `Sem variante ativa: ${tiposSemModelo.join(", ")}.`
        }
      />

      <Row
        level={data.janela.ativo_no_horario ? "ok" : "warn"}
        title="Janela de envio"
        desc={
          <>
            Configurada: {data.janela.inicio} – {data.janela.fim} (BRT).{" "}
            {data.janela.ativo_no_horario
              ? "Dentro da janela agora."
              : "Fora da janela — mensagens serão reagendadas."}
          </>
        }
      />

      <Row
        level={
          !cronAtivo
            ? "fail"
            : cronRecente && cronStatus !== "failed"
              ? "ok"
              : "warn"
        }
        title="Cron de envio"
        desc={
          !cronAtivo ? (
            "Nenhum cron job ativo encontrado para /api/public/hooks/reguas-cron. Agende em Lovable Cloud."
          ) : (
            <>
              <code>{cronAtivo.jobname}</code> · {cronAtivo.schedule} ·{" "}
              {ultimaExec
                ? `última: ${fmtBRT(ultimaExec.toISOString())} (${cronStatus ?? "?"})`
                : "ainda não executou"}
            </>
          )
        }
      />

      <Row
        level={
          data.fila.atrasadas > 0 || data.fila.falhas_24h > 0
            ? "warn"
            : "ok"
        }
        title="Fila de mensagens"
        desc={
          <>
            Próximas 24h: <strong>{data.fila.proximas_24h}</strong> · Atrasadas:{" "}
            <strong>{data.fila.atrasadas}</strong> · Travadas em envio:{" "}
            <strong>{data.fila.enviando_travadas}</strong> · Falhas 24h:{" "}
            <strong>{data.fila.falhas_24h}</strong>
          </>
        }
      />

      <div className="rounded-2xl bg-card shadow-soft p-4 mt-2">
        <div className="text-label mb-2">Próximas 5 mensagens</div>
        {data.proximas.length === 0 ? (
          <p className="text-caption text-muted-foreground">
            Nenhuma mensagem pendente.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {data.proximas.map((m) => (
              <li
                key={m.id}
                className="py-2 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-caption font-medium truncate">
                    {TIPOS_LABEL[m.tipo] ?? m.tipo} ·{" "}
                    {m.paciente ?? "(sem paciente)"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {fmtBRT(m.agendado_para)}
                  </div>
                </div>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {m.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
