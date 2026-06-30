import { useEffect, useMemo, useRef } from "react";
import {
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { endOfDay, startOfDay } from "@/lib/agenda";

/* ------------------------------------------------------------------ */
/* Single RPC home_summary() backs every hook below                    */
/* ------------------------------------------------------------------ */

export type FunilEtapa = {
  etapa: string;
  label: string;
  count: number;
  valor: number;
};

export type TicketProc = { nome: string; ticket: number; volume: number };

type HomeSummary = {
  greeting: string;
  leads_novos: number;
  followups_atrasados: number;
  a_confirmar_hoje: number;
  unread: number;
  mini_funil: Array<{ etapa: string; count: number; valor: number }>;
  no_show: { faltou: number; total: number; rate: number };
  ticket_medio: Array<{ nome: string; ticket: number; volume: number }>;
  recall: { denom: number; num: number; rate: number };
};

const ETAPA_LABEL: Record<string, string> = {
  novo_lead: "Novos leads",
  primeiro_contato: "1º contato",
  avaliacao_agendada: "Avaliação agendada",
  avaliacao_realizada: "Avaliação feita",
  orcamento_enviado: "Orçamento",
  negociacao: "Negociação",
  procedimento_agendado: "Procedimento agendado",
  cliente: "Cliente",
  pos_procedimento: "Pós-procedimento",
};

async function fetchHomeSummary(): Promise<HomeSummary> {
  const { data, error } = await supabase.rpc("home_summary");
  if (error) throw error;
  return (data ?? {}) as HomeSummary;
}

export const homeSummaryQueryOptions = {
  queryKey: ["home-summary"] as const,
  queryFn: fetchHomeSummary,
  staleTime: 30_000,
};

function useHomeSlice<T>(
  select: (s: HomeSummary) => T,
): UseQueryResult<T, Error> {
  return useQuery({
    ...homeSummaryQueryOptions,
    select,
  });
}

/* ------- Public hooks (compat with existing components) ------- */

export function useGreetingName() {
  return useHomeSlice((s) => s.greeting ?? "Dra.");
}

export function useLeadsNovosCount() {
  return useHomeSlice((s) => s.leads_novos ?? 0);
}

export function useFollowupsAtrasadosCount() {
  return useHomeSlice((s) => s.followups_atrasados ?? 0);
}

export function useMiniFunil() {
  return useHomeSlice<FunilEtapa[]>((s) =>
    (s.mini_funil ?? []).map((e) => ({
      etapa: e.etapa,
      label: ETAPA_LABEL[e.etapa] ?? e.etapa,
      count: Number(e.count) || 0,
      valor: Number(e.valor) || 0,
    })),
  );
}

export function useTicketMedioPorProcedimento(_enabled: boolean) {
  return useHomeSlice<TicketProc[]>((s) =>
    (s.ticket_medio ?? []).map((t) => ({
      nome: t.nome,
      ticket: Number(t.ticket) || 0,
      volume: Number(t.volume) || 0,
    })),
  );
}

export function useRecallConversionRate(_enabled: boolean) {
  return useHomeSlice((s) => ({
    rate: Number(s.recall?.rate) || 0,
    denom: Number(s.recall?.denom) || 0,
    num: Number(s.recall?.num) || 0,
  }));
}

export function useNoShowMes(_enabled: boolean) {
  return useHomeSlice((s) => ({
    rate: Number(s.no_show?.rate) || 0,
    faltou: Number(s.no_show?.faltou) || 0,
    total: Number(s.no_show?.total) || 0,
  }));
}

export function useToday() {
  return useMemo(() => {
    const d = new Date();
    return {
      from: startOfDay(d),
      to: endOfDay(d),
      label: d.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      }),
    };
  }, []);
}

/* ------- Realtime: throttled invalidations ------- */

export function useHomeRealtime() {
  const qc = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const schedule = () => {
      if (timerRef.current) return;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        qc.invalidateQueries({ queryKey: ["home-summary"] });
      }, 2000);
    };
    const ch = supabase
      .channel("home-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "oportunidades" },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agendamentos" },
        schedule,
      )
      .subscribe();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      supabase.removeChannel(ch);
    };
  }, [qc]);
}
