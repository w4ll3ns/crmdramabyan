import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  type AgendamentoStatus,
  endOfDay,
  startOfDay,
} from "@/lib/agenda";

export type Procedimento = Pick<
  Database["public"]["Tables"]["procedimentos"]["Row"],
  "id" | "nome" | "duracao_minutos" | "valor_padrao" | "categoria"
>;

export type Paciente = Pick<
  Database["public"]["Tables"]["pacientes"]["Row"],
  "id" | "nome" | "foto_url" | "telefone" | "whatsapp"
>;

export type AgendamentoFull =
  Database["public"]["Tables"]["agendamentos"]["Row"] & {
    paciente: Paciente | null;
    procedimento: Procedimento | null;
  };

const SELECT_FULL = `
  *,
  paciente:pacientes!agendamentos_paciente_id_fkey(id, nome, foto_url, telefone, whatsapp),
  procedimento:procedimentos!agendamentos_procedimento_id_fkey(id, nome, duracao_minutos, valor_padrao, categoria)
`;

function useAgendaRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("agendamentos-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agendamentos" },
        () => {
          qc.invalidateQueries({ queryKey: ["agendamentos"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

export function useAgendamentosRange(from: Date, to: Date) {
  useAgendaRealtime();
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  return useQuery({
    queryKey: ["agendamentos", "range", fromIso, toIso],
    queryFn: async (): Promise<AgendamentoFull[]> => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select(SELECT_FULL)
        .gte("data_hora", fromIso)
        .lte("data_hora", toIso)
        .order("data_hora", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as AgendamentoFull[];
    },
    staleTime: 5_000,
  });
}

export function useAgendamento(id: string | null) {
  return useQuery({
    queryKey: ["agendamentos", "one", id],
    queryFn: async (): Promise<AgendamentoFull | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("agendamentos")
        .select(SELECT_FULL)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as AgendamentoFull) ?? null;
    },
    enabled: !!id,
  });
}

export function useAConfirmarHojeCount(): number {
  useAgendaRealtime();
  const today = useMemo(() => new Date(), []);
  const q = useQuery({
    queryKey: ["agendamentos", "confirmar-hoje", today.toDateString()],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("agendamentos")
        .select("id", { count: "exact", head: true })
        .eq("status", "agendado")
        .gte("data_hora", startOfDay(today).toISOString())
        .lte("data_hora", endOfDay(today).toISOString());
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 10_000,
  });
  return q.data ?? 0;
}

export function useProcedimentos() {
  return useQuery({
    queryKey: ["procedimentos", "ativos"],
    queryFn: async (): Promise<Procedimento[]> => {
      const { data, error } = await supabase
        .from("procedimentos")
        .select("id, nome, duracao_minutos, valor_padrao, categoria")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

export function usePacientesSearch(term: string) {
  return useQuery({
    queryKey: ["pacientes", "search", term],
    queryFn: async (): Promise<Paciente[]> => {
      let q = supabase
        .from("pacientes")
        .select("id, nome, foto_url, telefone, whatsapp")
        .order("nome")
        .limit(20);
      if (term.trim()) q = q.ilike("nome", `%${term.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10_000,
  });
}

export function useCreatePacienteRapido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { nome: string; telefone?: string }) => {
      const { data, error } = await supabase
        .from("pacientes")
        .insert({
          nome: input.nome.trim(),
          telefone: input.telefone?.trim() || null,
          whatsapp: input.telefone?.trim() || null,
        })
        .select("id, nome, foto_url, telefone, whatsapp")
        .single();
      if (error) throw error;
      return data as Paciente;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pacientes"] });
    },
  });
}

export type AgendamentoInput = {
  id?: string;
  paciente_id: string;
  procedimento_id: string | null;
  tipo: Database["public"]["Enums"]["agendamento_tipo"];
  data_hora: string; // ISO
  duracao_minutos: number;
  valor: number | null;
  profissional: string | null;
  observacoes: string | null;
};

export function useUpsertAgendamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AgendamentoInput) => {
      if (input.id) {
        const { id, ...rest } = input;
        const { data, error } = await supabase
          .from("agendamentos")
          .update(rest)
          .eq("id", id)
          .select("id")
          .single();
        if (error) throw error;
        return data.id;
      }
      const { data, error } = await supabase
        .from("agendamentos")
        .insert(input)
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agendamentos"] });
    },
  });
}

export function useUpdateAgendamentoStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      status: AgendamentoStatus;
      paciente_id?: string;
      procedimento_id?: string | null;
      valor?: number | null;
    }) => {
      const { error } = await supabase
        .from("agendamentos")
        .update({ status: input.status })
        .eq("id", input.id);
      if (error) throw error;

      if (input.status === "realizado") {
        const { data: userData } = await supabase.auth.getUser();
        await supabase.from("audit_logs").insert({
          user_id: userData.user?.id ?? null,
          action: "realizado",
          entity: "agendamento",
          entity_id: input.id,
          metadata: {
            paciente_id: input.paciente_id ?? null,
            procedimento_id: input.procedimento_id ?? null,
            valor: input.valor ?? null,
          },
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agendamentos"] });
    },
  });
}

export async function ensureConversation(
  paciente: Paciente,
): Promise<string | null> {
  const phone = paciente.whatsapp || paciente.telefone;
  if (!phone) return null;
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("paciente_id", paciente.id)
    .order("ultima_mensagem_em", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      paciente_id: paciente.id,
      telefone: phone,
      status: "em_atendimento",
    })
    .select("id")
    .single();
  if (error) return null;
  return data.id;
}
