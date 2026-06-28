import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useClinicaNome() {
  return useQuery({
    queryKey: ["settings", "clinica_nome"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("valor")
        .eq("chave", "clinica_nome")
        .maybeSingle();
      if (error) throw error;
      const v = data?.valor;
      if (typeof v === "string") return v;
      return "";
    },
  });
}

export function useUpdateClinicaNome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nome: string) => {
      const trimmed = nome.trim();
      if (!trimmed) throw new Error("Nome não pode ficar vazio");
      if (trimmed.length > 80) throw new Error("Máximo 80 caracteres");
      const { error } = await supabase
        .from("settings")
        .upsert(
          { chave: "clinica_nome", valor: trimmed as never },
          { onConflict: "chave" },
        );
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["settings", "clinica_nome"] }),
  });
}
