import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SegmentedControl } from "@/components/brand/SegmentedControl";
import { BrandAvatar } from "@/components/brand/Avatar";
import { EmptyState } from "@/components/brand/EmptyState";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Filter = "nao_lidas" | "em_atendimento" | "todas";

type ConversaRow = {
  id: string;
  telefone: string;
  status: string;
  ultima_mensagem_em: string | null;
  paciente: { id: string; nome: string; foto_url: string | null } | null;
  ultima_msg: { content_text: string | null; type: string; direction: string } | null;
  unread: number;
};

async function fetchConversas(filter: Filter): Promise<ConversaRow[]> {
  let query = supabase
    .from("conversations")
    .select(
      `id, telefone, status, ultima_mensagem_em,
       paciente:pacientes!conversations_paciente_id_fkey(id, nome, foto_url)`,
    )
    .order("ultima_mensagem_em", { ascending: false, nullsFirst: false })
    .limit(100);
  if (filter === "nao_lidas") query = query.eq("status", "nao_lida");
  if (filter === "em_atendimento") query = query.eq("status", "em_atendimento");
  const { data, error } = await query;
  if (error) throw error;

  const ids = (data ?? []).map((c) => c.id);
  if (ids.length === 0) return [];

  // Última mensagem por conversa
  const { data: msgs } = await supabase
    .from("messages")
    .select("conversation_id, content_text, type, direction, created_at, status")
    .in("conversation_id", ids)
    .order("created_at", { ascending: false });
  const lastBy: Record<string, any> = {};
  const unreadBy: Record<string, number> = {};
  for (const m of msgs ?? []) {
    if (!lastBy[m.conversation_id]) lastBy[m.conversation_id] = m;
    if (m.direction === "inbound" && (m.status === null || m.status === "")) {
      unreadBy[m.conversation_id] = (unreadBy[m.conversation_id] ?? 0) + 1;
    }
  }

  return (data ?? []).map((c: any) => ({
    id: c.id,
    telefone: c.telefone,
    status: c.status,
    ultima_mensagem_em: c.ultima_mensagem_em,
    paciente: c.paciente,
    ultima_msg: lastBy[c.id] ?? null,
    unread: unreadBy[c.id] ?? 0,
  }));
}

function previewText(m: ConversaRow["ultima_msg"]): string {
  if (!m) return "Nenhuma mensagem ainda";
  if (m.type === "image") return "📷 Foto";
  if (m.type === "audio") return "🎤 Áudio";
  if (m.type === "video") return "🎬 Vídeo";
  if (m.type === "document") return "📎 Documento";
  return m.content_text ?? "";
}

function ConversasPage() {
  const [filter, setFilter] = useState<Filter>("todas");
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["conversas", "list", filter],
    queryFn: () => fetchConversas(filter),
    staleTime: 10_000,
  });

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("conversas-list-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => qc.invalidateQueries({ queryKey: ["conversas", "list"] }),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => qc.invalidateQueries({ queryKey: ["conversas", "list"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const filtered = useMemo(() => {
    const list = data ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (c) =>
        (c.paciente?.nome ?? "").toLowerCase().includes(q) ||
        c.telefone.toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="px-5 flex flex-col gap-3">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            strokeWidth={1.5}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar paciente ou telefone"
            className="w-full h-11 pl-9 pr-3 rounded-2xl border border-border bg-card text-label placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={[
            { value: "todas", label: "Todas" },
            { value: "nao_lidas", label: "Não lidas" },
            { value: "em_atendimento", label: "Em atendimento" },
          ]}
        />
      </div>

      <div className="px-3">
        {isLoading ? (
          <div className="px-2 py-6 text-center text-caption text-muted-foreground">
            Carregando…
          </div>
        ) : filtered.length === 0 ? (
          <div className="pt-10">
            <EmptyState
              icon={<MessageCircle className="h-7 w-7" strokeWidth={1.5} />}
              title="Nenhuma conversa"
              description="As mensagens recebidas no WhatsApp aparecerão aqui."
            />
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {filtered.map((c) => {
              const nome = c.paciente?.nome || c.telefone;
              return (
                <li key={c.id}>
                  <Link
                    to="/app/conversas/$conversaId"
                    params={{ conversaId: c.id }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-3 min-h-[68px] rounded-2xl",
                      "transition-colors active:bg-muted/60",
                    )}
                  >
                    <BrandAvatar name={nome} size={48} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <div
                          className={cn(
                            "text-label truncate",
                            c.unread > 0 ? "font-semibold" : "",
                          )}
                        >
                          {nome}
                        </div>
                        <div className="ml-auto text-caption text-muted-foreground shrink-0">
                          {formatRelativeTime(c.ultima_mensagem_em)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div
                          className={cn(
                            "text-caption truncate flex-1",
                            c.unread > 0
                              ? "text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {previewText(c.ultima_msg)}
                        </div>
                        {c.unread > 0 ? (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold flex items-center justify-center">
                            {c.unread}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/app/conversas/")({
  component: ConversasPage,
});
