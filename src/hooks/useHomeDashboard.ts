import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { endOfDay, startOfDay } from "@/lib/agenda";

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function useGreetingName() {
  return useQuery({
    queryKey: ["home", "greeting-name"],
    queryFn: async (): Promise<string> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return "Dra.";
      const { data: prof } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", u.user.id)
        .maybeSingle();
      const raw =
        prof?.name?.trim() ||
        u.user.user_metadata?.name ||
        u.user.user_metadata?.full_name ||
        u.user.email?.split("@")[0] ||
        "Dra.";
      const first = String(raw).split(" ")[0] ?? "Dra.";
      return first.charAt(0).toUpperCase() + first.slice(1);
    },
    staleTime: 5 * 60_000,
  });
}

export function useLeadsNovosCount() {
  return useQuery({
    queryKey: ["home", "leads-novos"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const { count, error } = await supabase
        .from("oportunidades")
        .select("id", { count: "exact", head: true })
        .eq("status", "ativa")
        .eq("etapa", "novo_lead")
        .gte("created_at", since.toISOString());
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 30_000,
  });
}

export function useFollowupsAtrasadosCount() {
  return useQuery({
    queryKey: ["home", "followups-atrasados"],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const [op, tk] = await Promise.all([
        supabase
          .from("oportunidades")
          .select("id", { count: "exact", head: true })
          .eq("status", "ativa")
          .lt("proximo_followup_em", nowIso),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("status", "pendente")
          .lt("due_date", nowIso),
      ]);
      return (op.count ?? 0) + (tk.count ?? 0);
    },
    staleTime: 30_000,
  });
}

export type FunilEtapa = {
  etapa: string;
  label: string;
  count: number;
  valor: number;
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

const ETAPA_ORDER = [
  "novo_lead",
  "primeiro_contato",
  "avaliacao_agendada",
  "avaliacao_realizada",
  "orcamento_enviado",
  "negociacao",
  "procedimento_agendado",
];

export function useMiniFunil() {
  return useQuery({
    queryKey: ["home", "mini-funil"],
    queryFn: async (): Promise<FunilEtapa[]> => {
      const { data, error } = await supabase
        .from("oportunidades")
        .select("etapa, valor_estimado")
        .eq("status", "ativa");
      if (error) throw error;
      const map = new Map<string, { count: number; valor: number }>();
      for (const r of data ?? []) {
        const cur = map.get(r.etapa) ?? { count: 0, valor: 0 };
        cur.count += 1;
        cur.valor += Number(r.valor_estimado ?? 0);
        map.set(r.etapa, cur);
      }
      return ETAPA_ORDER.filter((e) => map.has(e)).map((e) => ({
        etapa: e,
        label: ETAPA_LABEL[e] ?? e,
        count: map.get(e)!.count,
        valor: map.get(e)!.valor,
      }));
    },
    staleTime: 30_000,
  });
}

export type TicketProc = { nome: string; ticket: number; volume: number };

export function useTicketMedioPorProcedimento(enabled: boolean) {
  return useQuery({
    queryKey: ["home", "ticket-medio-proc"],
    enabled,
    queryFn: async (): Promise<TicketProc[]> => {
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const { data, error } = await supabase
        .from("agendamentos")
        .select("valor, procedimento:procedimentos!agendamentos_procedimento_id_fkey(nome)")
        .eq("status", "realizado")
        .gte("data_hora", since.toISOString())
        .not("procedimento_id", "is", null);
      if (error) throw error;
      const map = new Map<string, { soma: number; n: number }>();
      for (const r of (data ?? []) as Array<{
        valor: number | null;
        procedimento: { nome: string } | null;
      }>) {
        const nome = r.procedimento?.nome ?? "—";
        const cur = map.get(nome) ?? { soma: 0, n: 0 };
        if (r.valor != null) {
          cur.soma += Number(r.valor);
          cur.n += 1;
        }
        map.set(nome, cur);
      }
      return Array.from(map.entries())
        .map(([nome, v]) => ({
          nome,
          ticket: v.n ? v.soma / v.n : 0,
          volume: v.n,
        }))
        .filter((p) => p.volume > 0)
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 3);
    },
    staleTime: 60_000,
  });
}

export function useRecallConversionRate(enabled: boolean) {
  return useQuery({
    queryKey: ["home", "recall-rate"],
    enabled,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data: evts, error } = await supabase
        .from("automacao_eventos")
        .select("paciente_id, created_at")
        .eq("tipo", "recall")
        .gte("created_at", since.toISOString());
      if (error) throw error;
      const denom = evts?.length ?? 0;
      if (!denom) return { rate: 0, denom: 0, num: 0 };
      let num = 0;
      for (const e of evts!) {
        const { count } = await supabase
          .from("agendamentos")
          .select("id", { count: "exact", head: true })
          .eq("paciente_id", e.paciente_id)
          .gt("created_at", e.created_at);
        if ((count ?? 0) > 0) num += 1;
      }
      return { rate: num / denom, denom, num };
    },
    staleTime: 60_000,
  });
}

export function useNoShowMes(enabled: boolean) {
  return useQuery({
    queryKey: ["home", "no-show-mes"],
    enabled,
    queryFn: async () => {
      const start = startOfMonth().toISOString();
      const [faltou, realizado] = await Promise.all([
        supabase
          .from("agendamentos")
          .select("id", { count: "exact", head: true })
          .eq("status", "faltou")
          .gte("data_hora", start),
        supabase
          .from("agendamentos")
          .select("id", { count: "exact", head: true })
          .eq("status", "realizado")
          .gte("data_hora", start),
      ]);
      const f = faltou.count ?? 0;
      const r = realizado.count ?? 0;
      const total = f + r;
      return { rate: total ? f / total : 0, faltou: f, total };
    },
    staleTime: 60_000,
  });
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

export function useHomeRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("home-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "oportunidades" },
        () => qc.invalidateQueries({ queryKey: ["home"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => qc.invalidateQueries({ queryKey: ["home"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);
}
