import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DiagCronJob = {
  jobname: string;
  schedule: string;
  active: boolean;
  last_status: string | null;
  last_start: string | null;
};

export type DiagnosticoData = {
  pausado: boolean;
  pausaAuto: { ativo: boolean; desde: string | null; motivo: string | null };
  janela: { inicio: string; fim: string; ativo_no_horario: boolean };
  zapi: { conectada: boolean; status: string | null };
  modelosAtivosPorTipo: Record<string, number>;
  cron: DiagCronJob[];
  fila: {
    proximas_24h: number;
    atrasadas: number;
    enviando_travadas: number;
    falhas_24h: number;
  };
  proximas: Array<{
    id: string;
    tipo: string;
    paciente: string | null;
    agendado_para: string;
    status: string;
  }>;
};

const TIPOS_AUTOMATICOS = [
  "confirmacao",
  "lembrete",
  "pos_procedimento",
  "retorno",
  "recall",
  "aniversario",
  "reativacao",
  "no_show",
] as const;

function horaAtualBRT() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Fortaleza",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [h, m] = fmt.format(now).split(":").map(Number);
  return h * 60 + m;
}

function dentroJanela(inicio: string, fim: string) {
  const [hi, mi] = inicio.split(":").map(Number);
  const [hf, mf] = fim.split(":").map(Number);
  const now = horaAtualBRT();
  return now >= hi * 60 + mi && now <= hf * 60 + mf;
}

export function useDiagnostico() {
  return useQuery<DiagnosticoData>({
    queryKey: ["automacoes", "diagnostico"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const in24h = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const ago5m = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const ago10m = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const ago24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

      const [
        settingsR,
        zapiR,
        modelosR,
        cronR,
        proximas24R,
        atrasadasR,
        enviandoR,
        falhas24R,
        proximasListR,
      ] = await Promise.all([
        supabase
          .from("settings")
          .select("chave, valor")
          .in("chave", [
            "automacoes_pausado",
            "automacoes_pausa_auto",
            "automacoes_janela_inicio",
            "automacoes_janela_fim",
          ]),
        supabase
          .from("zapi_instances")
          .select("status")
          .order("updated_at", { ascending: false })
          .limit(1),
        supabase
          .from("modelos_mensagem")
          .select("tipo, ativo"),
        supabase.rpc("diag_cron_jobs"),
        supabase
          .from("mensagens_agendadas")
          .select("id", { count: "exact", head: true })
          .eq("status", "pendente")
          .lte("agendado_para", in24h)
          .gte("agendado_para", nowIso),
        supabase
          .from("mensagens_agendadas")
          .select("id", { count: "exact", head: true })
          .eq("status", "pendente")
          .lt("agendado_para", ago5m),
        supabase
          .from("mensagens_agendadas")
          .select("id", { count: "exact", head: true })
          .eq("status", "enviando")
          .lt("updated_at", ago10m),
        supabase
          .from("mensagens_agendadas")
          .select("id", { count: "exact", head: true })
          .eq("status", "falhou")
          .gte("updated_at", ago24h),
        supabase
          .from("mensagens_agendadas")
          .select("id, tipo, status, agendado_para, pacientes(nome)")
          .eq("status", "pendente")
          .order("agendado_para", { ascending: true })
          .limit(5),
      ]);

      const settingsMap: Record<string, unknown> = {};
      for (const r of settingsR.data ?? []) settingsMap[r.chave] = r.valor;

      const pausado =
        settingsMap.automacoes_pausado === true ||
        settingsMap.automacoes_pausado === "true";
      const pa = (settingsMap.automacoes_pausa_auto ?? {}) as {
        ativo?: boolean;
        desde?: string;
        motivo?: string;
      };

      const inicio =
        (typeof settingsMap.automacoes_janela_inicio === "string"
          ? settingsMap.automacoes_janela_inicio
          : null) ?? "08:00";
      const fim =
        (typeof settingsMap.automacoes_janela_fim === "string"
          ? settingsMap.automacoes_janela_fim
          : null) ?? "20:00";

      const modelosAtivosPorTipo: Record<string, number> = {};
      for (const t of TIPOS_AUTOMATICOS) modelosAtivosPorTipo[t] = 0;
      for (const r of modelosR.data ?? []) {
        if (r.ativo) {
          modelosAtivosPorTipo[r.tipo] =
            (modelosAtivosPorTipo[r.tipo] ?? 0) + 1;
        }
      }

      const zapiStatus = zapiR.data?.[0]?.status ?? null;

      return {
        pausado,
        pausaAuto: {
          ativo: !!pa.ativo,
          desde: pa.desde ?? null,
          motivo: pa.motivo ?? null,
        },
        janela: {
          inicio,
          fim,
          ativo_no_horario: dentroJanela(inicio, fim),
        },
        zapi: {
          conectada: zapiStatus === "connected",
          status: zapiStatus,
        },
        modelosAtivosPorTipo,
        cron: (cronR.data ?? []) as DiagCronJob[],
        fila: {
          proximas_24h: proximas24R.count ?? 0,
          atrasadas: atrasadasR.count ?? 0,
          enviando_travadas: enviandoR.count ?? 0,
          falhas_24h: falhas24R.count ?? 0,
        },
        proximas: (proximasListR.data ?? []).map((r) => ({
          id: r.id as string,
          tipo: r.tipo as string,
          paciente:
            ((r.pacientes as unknown as { nome?: string } | null)?.nome) ??
            null,
          agendado_para: r.agendado_para as string,
          status: r.status as string,
        })),
      };
    },
  });
}
