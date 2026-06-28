import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DiaKey = "seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom";
export type Expediente = Record<DiaKey, [string, string] | null>;

const DIAS: DiaKey[] = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];

const DEFAULT_EXP: Expediente = {
  seg: ["08:00", "18:00"],
  ter: ["08:00", "18:00"],
  qua: ["08:00", "18:00"],
  qui: ["08:00", "18:00"],
  sex: ["08:00", "18:00"],
  sab: null,
  dom: null,
};

export function useExpediente() {
  return useQuery({
    queryKey: ["settings", "agenda_expediente"],
    queryFn: async (): Promise<Expediente> => {
      const { data, error } = await supabase
        .from("settings")
        .select("valor")
        .eq("chave", "agenda_expediente")
        .maybeSingle();
      if (error) throw error;
      const v = (data?.valor as Partial<Expediente> | null) ?? null;
      if (!v) return DEFAULT_EXP;
      const out = { ...DEFAULT_EXP };
      for (const d of DIAS) {
        const f = v[d];
        if (Array.isArray(f) && f.length === 2) out[d] = [String(f[0]), String(f[1])];
        else out[d] = null;
      }
      return out;
    },
  });
}

export function useUpdateExpediente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (exp: Expediente) => {
      const { error } = await supabase
        .from("settings")
        .upsert(
          { chave: "agenda_expediente", valor: exp as never },
          { onConflict: "chave" },
        );
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["settings", "agenda_expediente"] }),
  });
}

export type Bloqueio = {
  id: string;
  data: string;
  motivo: string | null;
  dia_inteiro: boolean;
  inicio: string | null;
  fim: string | null;
};

export function useBloqueios() {
  return useQuery({
    queryKey: ["agenda_bloqueios"],
    queryFn: async (): Promise<Bloqueio[]> => {
      const { data, error } = await supabase
        .from("agenda_bloqueios")
        .select("id,data,motivo,dia_inteiro,inicio,fim")
        .order("data", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Bloqueio[];
    },
  });
}

export function useCreateBloqueio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      data: string;
      motivo?: string;
      dia_inteiro: boolean;
      inicio?: string | null;
      fim?: string | null;
    }) => {
      const { error } = await supabase.from("agenda_bloqueios").insert({
        data: input.data,
        motivo: input.motivo ?? null,
        dia_inteiro: input.dia_inteiro,
        inicio: input.dia_inteiro ? null : (input.inicio ?? null),
        fim: input.dia_inteiro ? null : (input.fim ?? null),
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda_bloqueios"] }),
  });
}

export function useDeleteBloqueio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agenda_bloqueios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda_bloqueios"] }),
  });
}

export const DIAS_LABEL: Record<DiaKey, string> = {
  seg: "Segunda",
  ter: "Terça",
  qua: "Quarta",
  qui: "Quinta",
  sex: "Sexta",
  sab: "Sábado",
  dom: "Domingo",
};
export const DIAS_ORDEM = DIAS;
