import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const REGUA_KEYS = [
  "automacoes_pausado",
  "automacoes_pausa_auto",
  "regua_confirmacao",
  "regua_lembrete",
  "regua_pos_procedimento",
  "regua_retorno",
  "regua_recall",
  "regua_aniversario",
  "regua_no_show",
  "regua_reativacao",
] as const;

export type ReguaKey = (typeof REGUA_KEYS)[number];

export type ReguasMap = Partial<Record<ReguaKey, unknown>>;

export function useReguas() {
  return useQuery({
    queryKey: ["settings", "reguas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("chave, valor")
        .in("chave", REGUA_KEYS as unknown as string[]);
      if (error) throw error;
      const map: ReguasMap = {};
      for (const row of data ?? []) {
        map[row.chave as ReguaKey] = row.valor as unknown;
      }
      return map;
    },
  });
}

export function useSetRegua() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ chave, valor }: { chave: ReguaKey; valor: unknown }) => {
      const { error } = await supabase
        .from("settings")
        .upsert({ chave, valor: valor as never }, { onConflict: "chave" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings", "reguas"] }),
  });
}

export type MetricasAutomacoes = {
  enviadas_30d: number;
  por_tipo: Record<string, { enviadas: number; pendentes: number; canceladas: number }>;
  taxa_confirmacao: number; // 0..1
  taxa_no_show: number;
  recalls_convertidos: number;
};

export function useMetricasAutomacoes() {
  return useQuery({
    queryKey: ["automacoes", "metricas"],
    queryFn: async (): Promise<MetricasAutomacoes> => {
      const desde = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

      const { data: msgs } = await supabase
        .from("mensagens_agendadas")
        .select("tipo, status, created_at, agendado_para, enviada_em")
        .gte("created_at", desde);

      const por_tipo: MetricasAutomacoes["por_tipo"] = {};
      let enviadas_30d = 0;
      for (const m of msgs ?? []) {
        const t = m.tipo as string;
        por_tipo[t] ??= { enviadas: 0, pendentes: 0, canceladas: 0 };
        if (m.status === "enviada" || m.status === "respondida") {
          por_tipo[t].enviadas += 1;
          enviadas_30d += 1;
        } else if (m.status === "pendente") por_tipo[t].pendentes += 1;
        else if (m.status === "cancelada") por_tipo[t].canceladas += 1;
      }

      const conf = por_tipo["confirmacao"]?.enviadas ?? 0;
      const { count: confirmados } = await supabase
        .from("agendamentos")
        .select("id", { count: "exact", head: true })
        .eq("confirmacao_resposta", "confirmado")
        .gte("confirmacao_respondida_em", desde);

      const { count: realizados } = await supabase
        .from("agendamentos")
        .select("id", { count: "exact", head: true })
        .eq("status", "realizado")
        .gte("data_hora", desde);
      const { count: faltas } = await supabase
        .from("agendamentos")
        .select("id", { count: "exact", head: true })
        .eq("status", "faltou")
        .gte("data_hora", desde);

      const taxa_confirmacao = conf > 0 ? (confirmados ?? 0) / conf : 0;
      const total_fim = (realizados ?? 0) + (faltas ?? 0);
      const taxa_no_show = total_fim > 0 ? (faltas ?? 0) / total_fim : 0;

      // Conversão de recall: agendamento criado nos 30d após envio
      const recalls_convertidos = 0; // placeholder simples

      return {
        enviadas_30d,
        por_tipo,
        taxa_confirmacao,
        taxa_no_show,
        recalls_convertidos,
      };
    },
  });
}
