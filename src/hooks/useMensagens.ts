import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ModeloTipo } from "@/lib/templates";

export type Modelo = {
  id: string;
  nome: string;
  tipo: ModeloTipo;
  corpo: string;
  ativo: boolean;
  updated_at: string;
};

export function useModelos() {
  return useQuery({
    queryKey: ["modelos_mensagem"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modelos_mensagem")
        .select("*")
        .order("tipo", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Modelo[];
    },
  });
}

export function useUpdateModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: Partial<Modelo> & { id: string }) => {
      const { error } = await supabase
        .from("modelos_mensagem")
        .update({ nome: m.nome, corpo: m.corpo, ativo: m.ativo })
        .eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["modelos_mensagem"] }),
  });
}

export type MensagemAgendada = {
  id: string;
  paciente_id: string;
  conversation_id: string | null;
  agendamento_id: string | null;
  modelo_id: string | null;
  tipo: ModeloTipo;
  conteudo_renderizado: string;
  variaveis: Record<string, unknown>;
  agendado_para: string;
  status: "pendente" | "enviada" | "cancelada" | "falhou" | "respondida";
  tentativas: number;
  enviada_em: string | null;
  erro: string | null;
  origem: "automacao" | "manual";
  created_by: string | null;
  created_at: string;
};

export function useMensagensAgendadasPaciente(pacienteId?: string) {
  return useQuery({
    queryKey: ["mensagens_agendadas", "paciente", pacienteId],
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mensagens_agendadas")
        .select("*")
        .eq("paciente_id", pacienteId!)
        .order("agendado_para", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as MensagemAgendada[];
    },
  });
}

export function useCreateMensagemAgendada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      paciente_id: string;
      conversation_id?: string | null;
      modelo_id?: string | null;
      tipo: ModeloTipo;
      conteudo_renderizado: string;
      variaveis?: Record<string, unknown>;
      agendado_para: string; // ISO
    }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("mensagens_agendadas").insert({
        paciente_id: input.paciente_id,
        conversation_id: input.conversation_id ?? null,
        modelo_id: input.modelo_id ?? null,
        tipo: input.tipo,
        conteudo_renderizado: input.conteudo_renderizado,
        variaveis: (input.variaveis ?? {}) as never,
        agendado_para: input.agendado_para,
        origem: "manual",
        created_by: u.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mensagens_agendadas"] }),
  });
}

export function useCancelarMensagem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("mensagens_agendadas")
        .update({ status: "cancelada" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mensagens_agendadas"] }),
  });
}

// Settings (chave/valor jsonb)
const KEYS = [
  "automacoes_janela_inicio",
  "automacoes_janela_fim",
  "automacoes_fuso",
  "automacoes_limite_minuto",
  "automacoes_palavra_optout",
  "automacoes_pausado",
] as const;
type SettingKey = (typeof KEYS)[number];

export type AutomacaoSettings = {
  automacoes_janela_inicio: string;
  automacoes_janela_fim: string;
  automacoes_fuso: string;
  automacoes_limite_minuto: number;
  automacoes_palavra_optout: string;
  automacoes_pausado: boolean;
};

const DEFAULTS: AutomacaoSettings = {
  automacoes_janela_inicio: "08:00",
  automacoes_janela_fim: "20:00",
  automacoes_fuso: "America/Fortaleza",
  automacoes_limite_minuto: 8,
  automacoes_palavra_optout: "sair",
  automacoes_pausado: false,
};

export function useAutomacaoSettings() {
  return useQuery({
    queryKey: ["automacao_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("chave, valor")
        .in("chave", KEYS as unknown as string[]);
      if (error) throw error;
      const out: AutomacaoSettings = { ...DEFAULTS };
      for (const r of data ?? []) {
        const k = r.chave as SettingKey;
        // valor é jsonb; pode vir como string/number/bool já parseado
        (out as Record<string, unknown>)[k] = r.valor as unknown;
      }
      return out;
    },
  });
}

export function useUpdateAutomacaoSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<AutomacaoSettings>) => {
      const rows = Object.entries(patch).map(([chave, valor]) => ({
        chave,
        valor: valor as never,
      }));
      for (const row of rows) {
        const { error } = await supabase
          .from("settings")
          .upsert(row, { onConflict: "chave" });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automacao_settings"] }),
  });
}
