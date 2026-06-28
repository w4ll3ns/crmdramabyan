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
    staleTime: 5_000,
  });

  useEffect(() => {
    const conversationsChannel = supabase
      .channel(`conversas-unread-conversations-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => {
          qc.invalidateQueries({ queryKey: ["conversas"] });
        },
      )
      .subscribe();

    const messagesChannel = supabase
      .channel(`conversas-unread-messages-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          qc.invalidateQueries({ queryKey: ["conversas"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationsChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [qc]);

  return query.data ?? 0;
}
