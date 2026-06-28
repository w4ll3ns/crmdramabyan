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
  Mic,
  Camera,
  Image as ImageIcon,
  File as FileIcon,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandAvatar } from "@/components/brand/Avatar";
import { BottomSheet } from "@/components/brand/BottomSheet";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format";
import { toast } from "sonner";
import {
  uploadChatMedia,
  kindFromMime,
  MAX_BYTES,
  type MediaKind,
} from "@/lib/chatMedia";
import { useAudioRecorder, extFromMime } from "@/hooks/useAudioRecorder";
import { AudioPlayer } from "@/components/conversa/AudioPlayer";
import {
  ImageMessage,
  VideoMessage,
  DocumentMessage,
} from "@/components/conversa/MediaBubble";

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
  const isVisualMedia = (m.type === "image" || m.type === "video") && m.media_url;
  return (
    <div className={cn("flex w-full", out ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl shadow-soft",
          isVisualMedia ? "p-1.5" : "px-3 py-2",
          out
            ? "bg-primary/15 text-foreground rounded-br-sm"
            : "bg-card text-foreground border border-border rounded-bl-sm",
        )}
      >
        {m.type === "image" && m.media_url ? (
          <ImageMessage src={m.media_url} />
        ) : null}
        {m.type === "audio" && m.media_url ? (
          <AudioPlayer src={m.media_url} outbound={out} />
        ) : null}
        {m.type === "video" && m.media_url ? (
          <VideoMessage src={m.media_url} />
        ) : null}
        {m.type === "document" && m.media_url ? (
          <DocumentMessage
            src={m.media_url}
            filename={m.content_text}
            caption={null}
          />
        ) : null}
        {m.content_text && m.type !== "document" && m.type !== "audio" ? (
          <div
            className={cn(
              "text-label whitespace-pre-wrap break-words",
              isVisualMedia ? "px-1.5 pt-1.5" : "",
            )}
          >
            {m.content_text}
          </div>
        ) : null}
        <div
          className={cn(
            "flex items-center gap-1 mt-1 text-[10px] text-muted-foreground",
            out ? "justify-end" : "justify-start",
            isVisualMedia ? "px-1.5 pb-0.5" : "",
          )}
        >
          <span>{formatTime(m.sent_at ?? m.created_at)}</span>
          {out ? <StatusIcon status={m.status} /> : null}
        </div>
      </div>
    </div>
  );
}

function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  const mm = Math.floor(s / 60).toString().padStart(1, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
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

  // Preview de arquivo escolhido
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [pendingCaption, setPendingCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  // Inputs ocultos
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Áudio
  const recorder = useAudioRecorder();
  const recBtnRef = useRef<HTMLButtonElement>(null);
  const recStartXRef = useRef<number>(0);
  const [recCancelling, setRecCancelling] = useState(false);

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

  // Cleanup preview URL
  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

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
      throw e;
    } finally {
      setSending(false);
    }
  }

  async function handleSendText() {
    const t = text.trim();
    if (!t) return;
    setText("");
    await send({ type: "text", content: t }).catch(() => setText(t));
  }

  function clearPending() {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(null);
    setPendingPreviewUrl(null);
    setPendingCaption("");
  }

  function pickFile(input: HTMLInputElement | null) {
    if (!input) return;
    input.value = "";
    input.click();
  }

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_BYTES) {
      toast.error("Arquivo muito grande", { description: "Máximo 16 MB." });
      return;
    }
    setAnexoOpen(false);
    setPendingFile(f);
    setPendingCaption("");
    const isMedia = f.type.startsWith("image/") || f.type.startsWith("video/");
    setPendingPreviewUrl(isMedia ? URL.createObjectURL(f) : null);
  }

  async function handleSendPendingFile() {
    if (!pendingFile) return;
    setUploading(true);
    try {
      const up = await uploadChatMedia(pendingFile, conversaId);
      await send({
        type: up.kind,
        media_url: up.url,
        media_mime_type: up.mime,
        filename: up.filename,
        content: pendingCaption.trim() || undefined,
      });
      clearPending();
    } catch (e: any) {
      toast.error("Falha no upload", { description: e?.message ?? String(e) });
    } finally {
      setUploading(false);
    }
  }

  async function sendRecordedAudio(blob: Blob, mime: string) {
    const ext = extFromMime(mime);
    const file = new File([blob], `audio-${Date.now()}.${ext}`, { type: mime });
    try {
      setUploading(true);
      const up = await uploadChatMedia(file, conversaId, { mime, filename: file.name });
      await send({
        type: "audio",
        media_url: up.url,
        media_mime_type: up.mime,
        filename: up.filename,
      });
    } catch (e: any) {
      toast.error("Falha ao enviar áudio", { description: e?.message ?? String(e) });
    } finally {
      setUploading(false);
    }
  }

  async function handleMicPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (sending || uploading) return;
    e.preventDefault();
    recStartXRef.current = e.clientX;
    setRecCancelling(false);
    try {
      recBtnRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    try {
      await recorder.start();
    } catch (err: any) {
      toast.error("Microfone indisponível", {
        description: err?.message ?? "Permita o acesso ao microfone.",
      });
    }
  }

  function handleMicPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!recorder.isRecording) return;
    const dx = e.clientX - recStartXRef.current;
    setRecCancelling(dx < -80);
  }

  async function handleMicPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    try {
      recBtnRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (!recorder.isRecording) return;
    if (recCancelling) {
      recorder.cancel();
      setRecCancelling(false);
      toast.message("Áudio cancelado");
      return;
    }
    const result = await recorder.stop();
    setRecCancelling(false);
    if (!result) return;
    if (result.durationMs < 600) {
      toast.message("Segure para gravar");
      return;
    }
    await sendRecordedAudio(result.blob, result.mime);
  }

  const list = useMemo(() => messages ?? [], [messages]);
  const showSend = text.trim().length > 0;
  const isRec = recorder.isRecording;

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

      {/* Inputs ocultos para escolher arquivo do aparelho */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={onFileChosen}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileChosen}
      />
      <input
        ref={docInputRef}
        type="file"
        accept="application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
        className="hidden"
        onChange={onFileChosen}
      />

      {/* Input bar */}
      <div className="border-t border-border bg-card pb-safe">
        {isRec ? (
          <div className="flex items-center gap-3 px-3 pt-2 pb-2 h-[56px]">
            <span className="inline-flex h-3 w-3 rounded-full bg-destructive animate-pulse" />
            <span className="text-label tabular-nums w-12">
              {formatElapsed(recorder.elapsedMs)}
            </span>
            <div
              className={cn(
                "flex-1 text-caption",
                recCancelling ? "text-destructive font-medium" : "text-muted-foreground",
              )}
            >
              {recCancelling ? "Solte para cancelar" : "← arraste para cancelar"}
            </div>
            <button
              ref={recBtnRef}
              onPointerMove={handleMicPointerMove}
              onPointerUp={handleMicPointerUp}
              onPointerCancel={handleMicPointerUp}
              className={cn(
                "h-12 w-12 shrink-0 inline-flex items-center justify-center rounded-full text-primary-foreground shadow-soft",
                recCancelling ? "bg-destructive" : "bg-primary",
              )}
              aria-label="Soltar para enviar"
            >
              {recCancelling ? (
                <Trash2 className="h-5 w-5" strokeWidth={1.75} />
              ) : (
                <Mic className="h-5 w-5" strokeWidth={1.75} />
              )}
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2 px-3 pt-2 pb-2">
            <button
              onClick={() => setAnexoOpen(true)}
              disabled={uploading}
              className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-full active:bg-muted/60 text-muted-foreground disabled:opacity-50"
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
            {showSend ? (
              <button
                onClick={handleSendText}
                disabled={sending}
                className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft disabled:opacity-50 active:scale-95 transition-transform"
                aria-label="Enviar"
              >
                <Send className="h-5 w-5" strokeWidth={1.75} />
              </button>
            ) : (
              <button
                ref={recBtnRef}
                onPointerDown={handleMicPointerDown}
                onPointerMove={handleMicPointerMove}
                onPointerUp={handleMicPointerUp}
                onPointerCancel={handleMicPointerUp}
                onContextMenu={(e) => e.preventDefault()}
                disabled={sending || uploading}
                className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft disabled:opacity-50 active:scale-95 transition-transform touch-none select-none"
                aria-label="Segurar para gravar"
              >
                <Mic className="h-5 w-5" strokeWidth={1.75} />
              </button>
            )}
          </div>
        )}
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

      {/* Anexar do aparelho */}
      <BottomSheet
        open={anexoOpen}
        onOpenChange={setAnexoOpen}
        title="Enviar arquivo"
        description="Escolha de onde enviar."
      >
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => pickFile(galleryInputRef.current)}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-muted active:bg-muted/70"
          >
            <ImageIcon className="h-6 w-6 text-primary" strokeWidth={1.5} />
            <span className="text-caption">Galeria</span>
          </button>
          <button
            onClick={() => pickFile(cameraInputRef.current)}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-muted active:bg-muted/70"
          >
            <Camera className="h-6 w-6 text-primary" strokeWidth={1.5} />
            <span className="text-caption">Câmera</span>
          </button>
          <button
            onClick={() => pickFile(docInputRef.current)}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-muted active:bg-muted/70"
          >
            <FileIcon className="h-6 w-6 text-primary" strokeWidth={1.5} />
            <span className="text-caption">Documento</span>
          </button>
        </div>
      </BottomSheet>

      {/* Preview do arquivo escolhido */}
      <BottomSheet
        open={!!pendingFile}
        onOpenChange={(o) => {
          if (!o && !uploading) clearPending();
        }}
        title="Enviar para o paciente"
      >
        {pendingFile ? (
          <div className="flex flex-col gap-3">
            <FilePreview file={pendingFile} previewUrl={pendingPreviewUrl} />
            {!pendingFile.type.startsWith("audio/") ? (
              <input
                value={pendingCaption}
                onChange={(e) => setPendingCaption(e.target.value)}
                placeholder="Legenda (opcional)"
                className="h-11 px-3 rounded-2xl border border-border bg-background text-label focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            ) : null}
            <div className="flex gap-2">
              <button
                onClick={clearPending}
                disabled={uploading}
                className="h-11 px-4 inline-flex items-center justify-center gap-1 rounded-2xl border border-border text-label disabled:opacity-50"
              >
                <X className="h-4 w-4" /> Cancelar
              </button>
              <button
                onClick={handleSendPendingFile}
                disabled={uploading}
                className="flex-1 h-11 rounded-2xl bg-primary text-primary-foreground text-label shadow-soft disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {uploading ? "Enviando…" : (
                  <>
                    <Send className="h-4 w-4" /> Enviar
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}
      </BottomSheet>
    </div>
  );
}

function FilePreview({ file, previewUrl }: { file: File; previewUrl: string | null }) {
  const kind: MediaKind = kindFromMime(file.type);
  const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
  if (kind === "image" && previewUrl) {
    return (
      <img src={previewUrl} alt="" className="rounded-xl max-h-72 w-full object-contain bg-muted" />
    );
  }
  if (kind === "video" && previewUrl) {
    return <video src={previewUrl} controls className="rounded-xl max-h-72 w-full bg-muted" />;
  }
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-muted/40">
      <FileIcon className="h-8 w-8 text-primary" strokeWidth={1.5} />
      <div className="min-w-0">
        <div className="text-label truncate">{file.name}</div>
        <div className="text-caption text-muted-foreground">{sizeMb} MB</div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/app/conversas/$conversaId")({
  component: ConversaDetail,
});
