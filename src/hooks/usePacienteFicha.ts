import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Paciente = Database["public"]["Tables"]["pacientes"]["Row"];
export type Anamnese = Database["public"]["Tables"]["anamneses"]["Row"];
export type FotoPaciente = Database["public"]["Tables"]["fotos_paciente"]["Row"];
export type FotoCategoria = Database["public"]["Enums"]["foto_categoria"];
export type FotoAngulo = Database["public"]["Enums"]["foto_angulo"];

const SIGNED_TTL = 60 * 5; // 5 min

export function usePaciente(id: string | null) {
  return useQuery({
    queryKey: ["paciente", id],
    queryFn: async (): Promise<Paciente | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("pacientes")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    enabled: !!id,
  });
}

export function usePacientesList(term: string) {
  return useQuery({
    queryKey: ["pacientes", "list", term],
    queryFn: async () => {
      let q = supabase
        .from("pacientes")
        .select(
          "id, nome, telefone, whatsapp, consentimento_lgpd, consentimento_imagem, data_nascimento",
        )
        .order("nome")
        .limit(100);
      const t = term.trim();
      if (t) q = q.or(`nome.ilike.%${t}%,telefone.ilike.%${t}%,whatsapp.ilike.%${t}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5_000,
  });
}

export function useUpsertPaciente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Partial<Paciente> & { nome: string; id?: string },
    ) => {
      if (input.id) {
        const { id, ...rest } = input;
        const { data, error } = await supabase
          .from("pacientes")
          .update(rest)
          .eq("id", id)
          .select("id")
          .single();
        if (error) throw error;
        return data.id;
      }
      const { data, error } = await supabase
        .from("pacientes")
        .insert(input)
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pacientes"] });
      qc.invalidateQueries({ queryKey: ["paciente"] });
    },
  });
}

export function useAnamnese(pacienteId: string | null) {
  return useQuery({
    queryKey: ["anamnese", pacienteId],
    queryFn: async (): Promise<Anamnese | null> => {
      if (!pacienteId) return null;
      const { data, error } = await supabase
        .from("anamneses")
        .select("*")
        .eq("paciente_id", pacienteId)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    enabled: !!pacienteId,
  });
}

export type AnamneseInput = Omit<
  Database["public"]["Tables"]["anamneses"]["Insert"],
  "id" | "created_at" | "updated_at" | "preenchida_por"
>;

export function useUpsertAnamnese() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AnamneseInput) => {
      const { data: u } = await supabase.auth.getUser();
      const payload = { ...input, preenchida_por: u.user?.id ?? null };
      const { data, error } = await supabase
        .from("anamneses")
        .upsert(payload, { onConflict: "paciente_id" })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["anamnese", vars.paciente_id] });
    },
  });
}

export function useFotos(pacienteId: string | null) {
  return useQuery({
    queryKey: ["fotos", pacienteId],
    queryFn: async (): Promise<FotoPaciente[]> => {
      if (!pacienteId) return [];
      const { data, error } = await supabase
        .from("fotos_paciente")
        .select("*")
        .eq("paciente_id", pacienteId)
        .order("data_foto", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!pacienteId,
  });
}

export function useUploadFoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      paciente_id: string;
      file: File;
      categoria: FotoCategoria;
      angulo: FotoAngulo;
      procedimento_id?: string | null;
      agendamento_id?: string | null;
      consentimento_uso: boolean;
      observacao?: string | null;
      data_foto?: string;
    }) => {
      const ext = input.file.name.split(".").pop()?.toLowerCase() || "jpg";
      const id = crypto.randomUUID();
      const path = `${input.paciente_id}/${id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("fotos-pacientes")
        .upload(path, input.file, {
          contentType: input.file.type || "image/jpeg",
          upsert: false,
        });
      if (upErr) throw upErr;
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("fotos_paciente")
        .insert({
          paciente_id: input.paciente_id,
          storage_path: path,
          categoria: input.categoria,
          angulo: input.angulo,
          procedimento_id: input.procedimento_id ?? null,
          agendamento_id: input.agendamento_id ?? null,
          consentimento_uso: input.consentimento_uso,
          observacao: input.observacao ?? null,
          data_foto: input.data_foto ?? new Date().toISOString(),
          created_by: u.user?.id ?? null,
        })
        .select("*")
        .single();
      if (error) {
        // rollback storage on db failure
        await supabase.storage.from("fotos-pacientes").remove([path]);
        throw error;
      }
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["fotos", vars.paciente_id] });
    },
  });
}

const signedCache = new Map<string, { url: string; exp: number }>();

export function useSignedFotoUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["fotoSignedUrl", path],
    queryFn: async (): Promise<string | null> => {
      if (!path) return null;
      const cached = signedCache.get(path);
      if (cached && cached.exp > Date.now()) return cached.url;
      const { data, error } = await supabase.storage
        .from("fotos-pacientes")
        .createSignedUrl(path, SIGNED_TTL);
      if (error) throw error;
      signedCache.set(path, {
        url: data.signedUrl,
        exp: Date.now() + (SIGNED_TTL - 30) * 1000,
      });
      return data.signedUrl;
    },
    enabled: !!path,
    staleTime: (SIGNED_TTL - 30) * 1000,
  });
}

export function useDeleteFoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (foto: FotoPaciente) => {
      const { error: delErr } = await supabase
        .from("fotos_paciente")
        .delete()
        .eq("id", foto.id);
      if (delErr) throw delErr;
      await supabase.storage
        .from("fotos-pacientes")
        .remove([foto.storage_path]);
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("audit_logs").insert({
        user_id: u.user?.id ?? null,
        action: "delete",
        entity: "foto_paciente",
        entity_id: foto.id,
        metadata: {
          paciente_id: foto.paciente_id,
          storage_path: foto.storage_path,
          categoria: foto.categoria,
        },
      });
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["fotos", vars.paciente_id] });
    },
  });
}

export function useIsAdmin() {
  return useQuery({
    queryKey: ["isAdmin"],
    queryFn: async (): Promise<boolean> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
    staleTime: 60_000,
  });
}

export function useAgendamentosDoPaciente(pacienteId: string | null) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!pacienteId) return;
    const ch = supabase
      .channel(`paciente-ag-${pacienteId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agendamentos",
          filter: `paciente_id=eq.${pacienteId}`,
        },
        () =>
          qc.invalidateQueries({
            queryKey: ["pacienteAgendamentos", pacienteId],
          }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [pacienteId, qc]);
  return useQuery({
    queryKey: ["pacienteAgendamentos", pacienteId],
    queryFn: async () => {
      if (!pacienteId) return [];
      const { data, error } = await supabase
        .from("agendamentos")
        .select(
          "id, data_hora, status, tipo, duracao_minutos, valor, procedimento:procedimentos(id, nome)",
        )
        .eq("paciente_id", pacienteId)
        .order("data_hora", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!pacienteId,
  });
}
