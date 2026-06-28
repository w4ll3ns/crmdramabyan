import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Paperclip,
  Send,
  MoreVertical,
  Check,
  CheckCheck,
  FileText,
  CalendarPlus,
  MessageSquareText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandAvatar } from "@/components/brand/Avatar";
import { BottomSheet } from "@/components/brand/BottomSheet";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format";
import { toast } from "sonner";

type Message = {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  type: "text" | "image" | "audio" | "video" | "document";
  content_text: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  status: string | null;
  sent_at: string | null;
  created_at: string;
};

async function fetchConversa(id: string) {
  const { data, error } = await supabase
    .from("conversations")
    .select(
      `id, telefone, status, ultima_mensagem_em, paciente_id, oportunidade_id,
       paciente:pacientes!conversations_paciente_id_fkey(id, nome, foto_url)`,
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

async function fetchMessages(id: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as Message[];
}

async function fetchModelos(): Promise<string[]> {
  const { data } = await supabase
    .from("settings")
    .select("valor")
    .eq("chave", "mensagem_modelos")
    .maybeSingle();
  const valor = data?.valor as unknown;
  if (Array.isArray(valor)) return valor as string[];
  return [];
}

function StatusIcon({ status }: { status: string | null }) {
  if (status === "lido")
    return <CheckCheck className="h-3.5 w-3.5 text-accent" strokeWidth={2} />;
  if (status === "entregue")
    return (
      <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
    );
  return <Check className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />;
}

function Bubble({ m }: { m: Message }) {
  const out = m.direction === "outbound";
  return (
    <div className={cn("flex w-full", out ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3 py-2 shadow-soft",
          out
            ? "bg-primary/15 text-foreground rounded-br-sm"
            : "bg-card text-foreground border border-border rounded-bl-sm",
        )}
      >
        {m.type === "image" && m.media_url ? (
          <a href={m.media_url} target="_blank" rel="noreferrer">
            <img
              src={m.media_url}
              alt=""
              className="rounded-xl max-h-64 object-cover"
            />
          </a>
        ) : null}
        {m.type === "audio" && m.media_url ? (
          <audio controls src={m.media_url} className="max-w-full" />
        ) : null}
        {m.type === "video" && m.media_url ? (
          <video controls src={m.media_url} className="rounded-xl max-h-64" />
        ) : null}
        {m.type === "document" && m.media_url ? (
          <a
            href={m.media_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-label underline"
          >
            <FileText className="h-4 w-4" strokeWidth={1.5} />
            {m.content_text || "Documento"}
          </a>
        ) : null}
        {m.content_text && m.type !== "document" ? (
          <div className="text-label whitespace-pre-wrap break-words">
            {m.content_text}
          </div>
        ) : null}
        <div
          className={cn(
            "flex items-center gap-1 mt-1 text-[10px] text-muted-foreground",
            out ? "justify-end" : "justify-start",
          )}
        >
          <span>{formatTime(m.sent_at ?? m.created_at)}</span>
          {out ? <StatusIcon status={m.status} /> : null}
        </div>
      </div>
    </div>
  );
}

function ConversaDetail() {
  const { conversaId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modelosOpen, setModelosOpen] = useState(false);
  const [anexoOpen, setAnexoOpen] = useState(false);
  const [anexoUrl, setAnexoUrl] = useState("");
  const [anexoTipo, setAnexoTipo] = useState<"image" | "audio" | "video" | "document">(
    "image",
  );
  const [anexoLegenda, setAnexoLegenda] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversa } = useQuery({
    queryKey: ["conversa", conversaId],
    queryFn: () => fetchConversa(conversaId),
  });
  const { data: messages } = useQuery({
    queryKey: ["conversa", conversaId, "messages"],
    queryFn: () => fetchMessages(conversaId),
    staleTime: 5_000,
  });
  const { data: modelos } = useQuery({
    queryKey: ["mensagem_modelos"],
    queryFn: fetchModelos,
    staleTime: 60_000,
  });

  // Marca como lida ao abrir
  useEffect(() => {
    (async () => {
      await supabase
        .from("conversations")
        .update({ status: "em_atendimento" })
        .eq("id", conversaId)
        .eq("status", "nao_lida");
      await supabase
        .from("messages")
        .update({ status: "lido" })
        .eq("conversation_id", conversaId)
        .eq("direction", "inbound")
        .is("status", null);
      qc.invalidateQueries({ queryKey: ["conversas"] });
    })();
  }, [conversaId, qc]);

  // Realtime de novas mensagens
  useEffect(() => {
    const ch = supabase
      .channel(`conversa-${conversaId}-msgs`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversaId}`,
        },
        () => {
          qc.invalidateQueries({
            queryKey: ["conversa", conversaId, "messages"],
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversaId, qc]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages?.length]);

  const nome = conversa?.paciente?.nome || conversa?.telefone || "Conversa";

  async function send(payload: {
    type: "text" | "image" | "audio" | "video" | "document";
    content?: string;
    media_url?: string;
    media_mime_type?: string;
    filename?: string;
  }) {
    if (sending) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("zapi-send", {
        body: { conversation_id: conversaId, ...payload },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      qc.invalidateQueries({ queryKey: ["conversa", conversaId, "messages"] });
      qc.invalidateQueries({ queryKey: ["conversas"] });
    } catch (e: any) {
      toast.error("Falha ao enviar", { description: e?.message ?? String(e) });
    } finally {
      setSending(false);
    }
  }

  async function handleSendText() {
    const t = text.trim();
    if (!t) return;
    setText("");
    await send({ type: "text", content: t });
  }

  async function handleSendAnexo() {
    if (!anexoUrl.trim()) return;
    await send({
      type: anexoTipo,
      media_url: anexoUrl.trim(),
      content: anexoLegenda.trim() || undefined,
    });
    setAnexoUrl("");
    setAnexoLegenda("");
    setAnexoOpen(false);
  }

  const list = useMemo(() => messages ?? [], [messages]);

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <header className="surface-tint sticky top-0 z-30 pt-safe border-b border-border/60 backdrop-blur">
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            onClick={() => navigate({ to: "/app/conversas" })}
            className="h-10 w-10 inline-flex items-center justify-center rounded-full active:bg-muted/60"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>
          {conversa?.paciente?.id ? (
            <Link
              to="/app/pacientes"
              className="flex items-center gap-2 flex-1 min-w-0"
            >
              <BrandAvatar name={nome} size={38} />
              <div className="min-w-0">
                <div className="text-label truncate">{nome}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {conversa?.telefone}
                </div>
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <BrandAvatar name={nome} size={38} />
              <div className="min-w-0">
                <div className="text-label truncate">{nome}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {conversa?.telefone}
                </div>
              </div>
            </div>
          )}
          <button
            onClick={() => setMenuOpen(true)}
            className="h-10 w-10 inline-flex items-center justify-center rounded-full active:bg-muted/60"
            aria-label="Mais"
          >
            <MoreVertical className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* Lista */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {list.length === 0 ? (
          <div className="text-center text-caption text-muted-foreground pt-10">
            Nenhuma mensagem ainda. Envie a primeira abaixo.
          </div>
        ) : (
          list.map((m) => <Bubble key={m.id} m={m} />)
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card pb-safe">
        <div className="flex items-end gap-2 px-3 pt-2 pb-2">
          <button
            onClick={() => setAnexoOpen(true)}
            className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-full active:bg-muted/60 text-muted-foreground"
            aria-label="Anexar"
          >
            <Paperclip className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setModelosOpen(true)}
            className="h-10 px-3 shrink-0 inline-flex items-center gap-1 rounded-full bg-muted text-label text-foreground active:bg-muted/70"
          >
            <MessageSquareText className="h-4 w-4" strokeWidth={1.5} />
            <span className="hidden sm:inline">Modelo</span>
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendText();
              }
            }}
            rows={1}
            placeholder="Mensagem"
            className="flex-1 resize-none min-h-[40px] max-h-[120px] px-3 py-2 rounded-2xl border border-border bg-background text-label placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            onClick={handleSendText}
            disabled={sending || !text.trim()}
            className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft disabled:opacity-50 active:scale-95 transition-transform"
            aria-label="Enviar"
          >
            <Send className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Menu */}
      <BottomSheet open={menuOpen} onOpenChange={setMenuOpen} title="Ações">
        <div className="flex flex-col gap-1">
          <button
            className="flex items-center gap-3 px-3 py-3 rounded-2xl active:bg-muted/60 text-left"
            onClick={() => {
              setMenuOpen(false);
              navigate({ to: "/app/agenda" });
            }}
          >
            <CalendarPlus className="h-5 w-5 text-primary" strokeWidth={1.5} />
            <span className="text-label">Agendar avaliação</span>
          </button>
          <button
            className="flex items-center gap-3 px-3 py-3 rounded-2xl active:bg-muted/60 text-left"
            onClick={() => {
              setMenuOpen(false);
              toast.message("Em breve", {
                description: "Criação rápida de tarefa.",
              });
            }}
          >
            <FileText className="h-5 w-5 text-primary" strokeWidth={1.5} />
            <span className="text-label">Criar tarefa</span>
          </button>
          <button
            className="flex items-center gap-3 px-3 py-3 rounded-2xl active:bg-muted/60 text-left"
            onClick={() => {
              setMenuOpen(false);
              navigate({ to: "/app/funil" });
            }}
          >
            <MessageSquareText className="h-5 w-5 text-primary" strokeWidth={1.5} />
            <span className="text-label">Mover etapa do funil</span>
          </button>
        </div>
      </BottomSheet>

      {/* Modelos */}
      <BottomSheet
        open={modelosOpen}
        onOpenChange={setModelosOpen}
        title="Modelos de mensagem"
        description={
          modelos && modelos.length > 0
            ? "Toque para inserir."
            : "Cadastre modelos em Configurações."
        }
      >
        {!modelos || modelos.length === 0 ? (
          <div className="text-caption text-muted-foreground py-4">
            Nenhum modelo cadastrado ainda.
          </div>
        ) : (
          <ul className="flex flex-col gap-1 max-h-[60vh] overflow-auto">
            {modelos.map((m, i) => (
              <li key={i}>
                <button
                  className="w-full text-left px-3 py-3 rounded-2xl active:bg-muted/60"
                  onClick={() => {
                    setText((t) => (t ? `${t}\n${m}` : m));
                    setModelosOpen(false);
                  }}
                >
                  <div className="text-label whitespace-pre-wrap line-clamp-3">
                    {m}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </BottomSheet>

      {/* Anexo */}
      <BottomSheet
        open={anexoOpen}
        onOpenChange={setAnexoOpen}
        title="Enviar mídia"
        description="Cole a URL pública do arquivo."
      >
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            {(["image", "audio", "video", "document"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setAnexoTipo(t)}
                className={cn(
                  "flex-1 py-2 rounded-xl text-label border",
                  anexoTipo === t
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-foreground",
                )}
              >
                {t === "image"
                  ? "Imagem"
                  : t === "audio"
                    ? "Áudio"
                    : t === "video"
                      ? "Vídeo"
                      : "Doc"}
              </button>
            ))}
          </div>
          <input
            value={anexoUrl}
            onChange={(e) => setAnexoUrl(e.target.value)}
            placeholder="https://..."
            className="h-11 px-3 rounded-2xl border border-border bg-background text-label focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {anexoTipo !== "audio" ? (
            <input
              value={anexoLegenda}
              onChange={(e) => setAnexoLegenda(e.target.value)}
              placeholder="Legenda (opcional)"
              className="h-11 px-3 rounded-2xl border border-border bg-background text-label focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          ) : null}
          <button
            onClick={handleSendAnexo}
            disabled={sending || !anexoUrl.trim()}
            className="h-11 rounded-2xl bg-primary text-primary-foreground text-label shadow-soft disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/app/conversas/$conversaId")({
  component: ConversaDetail,
});
