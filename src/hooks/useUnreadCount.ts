import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useUnreadCount() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["conversas", "unread-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("status", "nao_lida");
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        qc.invalidateQueries({ queryKey: ["conversas", "unread-count"] });
      }, 2000);
    };
    const ch = supabase
      .channel(`conversas-unread-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        schedule,
      )
      .subscribe();

    return () => {
      if (pending) clearTimeout(pending);
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return query.data ?? 0;
}
