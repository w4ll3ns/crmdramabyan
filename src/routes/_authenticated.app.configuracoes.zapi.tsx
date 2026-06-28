import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Smartphone, RefreshCw, Power, Lock, X, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Instance = {
  id: string;
  nome_instancia: string;
  instance_id: string;
  token: string;
  client_token: string | null;
  phone_number: string | null;
  status: string | null;
  connected: boolean;
};

type WebhookMap = {
  received?: boolean;
  delivery?: boolean;
  status?: boolean;
  connected?: boolean;
  disconnected?: boolean;
};

type ZapiRemoteStatus = {
  connected?: boolean;
  smartphoneConnected?: boolean;
  session?: string | boolean | null;
  connectedPhone?: string | null;
  webhookConfigured?: boolean;
  receivedWebhookConfigured?: boolean;
  receiveCallbackSentByMe?: boolean;
  webhooks?: Record<keyof WebhookMap, string>;
  webhookMatches?: WebhookMap;
  checkedAt?: string;
};

async function fetchInstance(): Promise<Instance | null> {
  const { data } = await supabase
    .from("zapi_instances")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Instance) ?? null;
}

function formatRelative(iso: string | undefined, nowMs: number): string {
  if (!iso) return "—";
  const diff = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 1000));
  if (diff < 5) return "agora";
  if (diff < 60) return `há ${diff}s`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  return `há ${h}h`;
}

const QR_TIMEOUT_MS = 90_000;

function ZapiConfig() {
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [qr, setQr] = useState<string | null>(null);
  const [qrStartedAt, setQrStartedAt] = useState<number | null>(null);
  const [polling, setPolling] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const reconnectedRef = useRef(false);

  const { data: instance, isLoading } = useQuery({
    queryKey: ["zapi-instance"],
    queryFn: fetchInstance,
  });
  const { data: remoteStatus } = useQuery({
    queryKey: ["zapi-remote-status", instance?.id],
    enabled: !!instance && isAdmin === true,
    queryFn: async (): Promise<ZapiRemoteStatus> => {
      const { data, error } = await supabase.functions.invoke(
        "zapi-instance-manager",
        { body: { action: "status" } },
      );
      if (error) throw error;
      return data ?? {};
    },
    refetchInterval: polling ? 3000 : 15_000,
    refetchIntervalInBackground: false,
  });

  const [form, setForm] = useState({
    nome_instancia: "",
    instance_id: "",
    token: "",
    client_token: "",
    phone_number: "",
  });

  useEffect(() => {
    if (instance) {
      setForm({
        nome_instancia: instance.nome_instancia ?? "",
        instance_id: instance.instance_id ?? "",
        token: instance.token ?? "",
        client_token: instance.client_token ?? "",
        phone_number: instance.phone_number ?? "",
      });
    }
  }, [instance]);

  // Relógio para "atualizado há Xs" e timeout do QR
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Quando o status reportar connected enquanto o QR está aberto → confirma reconexão
  useEffect(() => {
    if (!qr || !polling) return;
    if (remoteStatus?.connected && !reconnectedRef.current) {
      reconnectedRef.current = true;
      setPolling(false);
      setQr(null);
      setQrStartedAt(null);
      toast.success("WhatsApp reconectado");
      // Re-registra os webhooks (idempotente) e atualiza queries
      supabase.functions
        .invoke("zapi-instance-manager", {
          body: { action: "configure-webhook" },
        })
        .then(() => {
          qc.invalidateQueries({ queryKey: ["zapi-instance"] });
          qc.invalidateQueries({ queryKey: ["zapi-remote-status"] });
        });
    }
  }, [remoteStatus?.connected, qr, polling, qc]);

  // Timeout do QR
  useEffect(() => {
    if (!qr || !qrStartedAt) return;
    if (nowMs - qrStartedAt > QR_TIMEOUT_MS) {
      setPolling(false);
      setQr(null);
      setQrStartedAt(null);
      toast.error("QR expirado — gere um novo");
    }
  }, [nowMs, qr, qrStartedAt]);

  if (isAdmin === false) {
    return (
      <div className="px-5 pt-10 flex flex-col items-center gap-3 text-center">
        <Lock className="h-8 w-8 text-muted-foreground" strokeWidth={1.25} />
        <div className="text-h2">Acesso restrito</div>
        <p className="text-caption text-muted-foreground max-w-xs">
          Apenas administradores podem configurar a integração Z-API.
        </p>
        <button
          onClick={() => navigate({ to: "/app" })}
          className="mt-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-label"
        >
          Voltar
        </button>
      </div>
    );
  }

  async function salvar() {
    if (!form.instance_id.trim() || !form.token.trim()) {
      toast.error("Preencha Instance ID e Token");
      return;
    }
    const payload = {
      nome_instancia: form.nome_instancia || "Principal",
      instance_id: form.instance_id.trim(),
      token: form.token.trim(),
      client_token: form.client_token.trim() || null,
      phone_number: form.phone_number.trim() || null,
    };
    if (instance) {
      const { error } = await supabase
        .from("zapi_instances")
        .update(payload)
        .eq("id", instance.id);
      if (error) {
        toast.error("Erro ao salvar", { description: error.message });
        return;
      }
    } else {
      const { error } = await supabase.from("zapi_instances").insert(payload);
      if (error) {
        toast.error("Erro ao criar", { description: error.message });
        return;
      }
    }
    toast.success("Configuração salva");
    qc.invalidateQueries({ queryKey: ["zapi-instance"] });
    qc.invalidateQueries({ queryKey: ["zapi-remote-status"] });
  }

  async function conectar() {
    setQr(null);
    reconnectedRef.current = false;
    const { data, error } = await supabase.functions.invoke(
      "zapi-instance-manager",
      { body: { action: "qr-code" } },
    );
    if (error) {
      toast.error("Falha ao gerar QR", { description: error.message });
      return;
    }
    if (data?.connected) {
      toast.success("Já está conectado");
      qc.invalidateQueries({ queryKey: ["zapi-instance"] });
      qc.invalidateQueries({ queryKey: ["zapi-remote-status"] });
      return;
    }
    const img = data?.value || data?.image || data?.qrcode;
    if (img) {
      setQr(img.startsWith("data:") ? img : `data:image/png;base64,${img}`);
      setQrStartedAt(Date.now());
      setPolling(true);
    } else {
      toast.error("QR não recebido");
    }
  }

  function fecharQr() {
    setQr(null);
    setQrStartedAt(null);
    setPolling(false);
  }

  async function desconectar() {
    const { error } = await supabase.functions.invoke(
      "zapi-instance-manager",
      { body: { action: "disconnect" } },
    );
    if (error) {
      toast.error("Erro ao desconectar", { description: error.message });
      return;
    }
    toast.success("Desconectado");
    qc.invalidateQueries({ queryKey: ["zapi-instance"] });
    qc.invalidateQueries({ queryKey: ["zapi-remote-status"] });
  }

  async function atualizarStatus() {
    await qc.invalidateQueries({ queryKey: ["zapi-remote-status"] });
    qc.invalidateQueries({ queryKey: ["zapi-instance"] });
  }

  async function ativarRecebimento() {
    const { error } = await supabase.functions.invoke(
      "zapi-instance-manager",
      { body: { action: "configure-webhook" } },
    );
    if (error) {
      toast.error("Erro ao registrar webhooks", { description: error.message });
      return;
    }
    toast.success("Webhooks registrados");
    qc.invalidateQueries({ queryKey: ["zapi-remote-status"] });
  }

  const webhookMatches = remoteStatus?.webhookMatches ?? {};
  const webhookCount = (Object.values(webhookMatches) as boolean[]).filter(Boolean).length;
  const webhooksOk = webhookCount === 5;
  const phoneFromRemote = remoteStatus?.connectedPhone ?? null;
  const instanceConnected = !!(instance?.connected || remoteStatus?.connected);
  const smartphoneConnected = remoteStatus?.smartphoneConnected;

  const qrSecondsLeft =
    qr && qrStartedAt
      ? Math.max(0, Math.ceil((QR_TIMEOUT_MS - (nowMs - qrStartedAt)) / 1000))
      : 0;

  return (
    <div className="px-5 pt-5 pb-10 flex flex-col gap-5 max-w-xl mx-auto">
      <div className="flex items-center gap-3">
        <Smartphone className="h-6 w-6 text-primary" strokeWidth={1.5} />
        <div>
          <div className="text-h2">Z-API · WhatsApp</div>
          <div className="text-caption text-muted-foreground">
            Configure a instância exclusiva da clínica.
          </div>
        </div>
      </div>

      {/* Status detalhado */}
      <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="text-label font-medium">Status da conexão</div>
          <button
            onClick={atualizarStatus}
            className="h-8 w-8 inline-flex items-center justify-center rounded-full active:bg-muted/60"
            aria-label="Atualizar status"
          >
            <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <StatusRow
          label="Instância Z-API"
          state={instanceConnected ? "ok" : "off"}
          text={instanceConnected ? "Conectada" : "Desconectada"}
          hint={phoneFromRemote || instance?.phone_number || undefined}
        />
        <StatusRow
          label="Smartphone"
          state={
            smartphoneConnected === undefined
              ? "unknown"
              : smartphoneConnected
                ? "ok"
                : "warn"
          }
          text={
            smartphoneConnected === undefined
              ? "—"
              : smartphoneConnected
                ? "Online"
                : "Offline"
          }
          hint={
            smartphoneConnected === false
              ? "Celular sem internet ou app fechado"
              : undefined
          }
        />
        <StatusRow
          label="Webhooks"
          state={webhooksOk ? "ok" : webhookCount > 0 ? "warn" : "off"}
          text={`${webhookCount}/5 ativos`}
          hint={
            webhooksOk
              ? "received, delivery, status, connected, disconnected"
              : "Clique em Registrar webhooks abaixo"
          }
        />

        <div className="text-[11px] text-muted-foreground pt-1 border-t border-border">
          Atualizado {formatRelative(remoteStatus?.checkedAt, nowMs)}
          {remoteStatus?.session && typeof remoteStatus.session === "string"
            ? ` · sessão: ${remoteStatus.session}`
            : ""}
        </div>
      </div>

      {/* Form */}
      <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
        <div className="text-label font-medium">Credenciais</div>
        {[
          { k: "nome_instancia", l: "Nome (apelido)", ph: "Principal" },
          { k: "instance_id", l: "Instance ID", ph: "" },
          { k: "token", l: "Token", ph: "" },
          { k: "client_token", l: "Client-Token (Account Security)", ph: "" },
          { k: "phone_number", l: "Telefone vinculado", ph: "55…" },
        ].map((f) => (
          <label key={f.k} className="flex flex-col gap-1">
            <span className="text-caption text-muted-foreground">{f.l}</span>
            <input
              value={(form as any)[f.k]}
              onChange={(e) =>
                setForm((s) => ({ ...s, [f.k]: e.target.value }))
              }
              placeholder={f.ph}
              className="h-11 px-3 rounded-2xl border border-border bg-background text-label focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
        ))}
        <button
          onClick={salvar}
          disabled={isLoading}
          className="h-11 mt-2 rounded-2xl bg-primary text-primary-foreground text-label shadow-soft disabled:opacity-50"
        >
          Salvar credenciais
        </button>
      </div>

      {/* Ações */}
      <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
        <div className="text-label font-medium">Conexão</div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={conectar}
            disabled={!instance}
            className="flex-1 h-11 rounded-2xl bg-primary text-primary-foreground text-label shadow-soft disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            <QrCode className="h-4 w-4" strokeWidth={1.5} />
            {instanceConnected ? "Gerar novo QR" : "Reconectar (novo QR)"}
          </button>
          {instanceConnected ? (
            <button
              onClick={desconectar}
              className="h-11 px-4 rounded-2xl border border-border bg-card text-label inline-flex items-center gap-1"
            >
              <Power className="h-4 w-4" strokeWidth={1.5} />
              Desconectar
            </button>
          ) : null}
        </div>
        <button
          onClick={ativarRecebimento}
          disabled={!instance || !instanceConnected}
          className="h-11 rounded-2xl border border-border bg-card text-label disabled:opacity-50"
        >
          {webhooksOk ? "Re-registrar webhooks" : "Registrar webhooks"}
        </button>
      </div>

      {/* Webhook info */}
      <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-2">
        <div className="text-label font-medium">URL do webhook único</div>
        <div className="text-caption text-muted-foreground">
          Z-API exige HTTPS. Esta URL é registrada automaticamente nos 5
          callbacks ao clicar em "Registrar webhooks".
        </div>
        <code className="block px-3 py-2 rounded-xl bg-muted text-[12px] break-all">
          {(import.meta.env.VITE_SUPABASE_URL || "") +
            "/functions/v1/zapi-webhook?token=<ZAPI_WEBHOOK_TOKEN>"}
        </code>
      </div>

      {/* QR dialog */}
      {qr ? (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
          <div className="bg-card rounded-2xl border border-border p-5 w-full max-w-sm flex flex-col items-center gap-3 relative">
            <button
              onClick={fecharQr}
              className="absolute top-3 right-3 h-8 w-8 inline-flex items-center justify-center rounded-full active:bg-muted/60"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <div className="text-h2">Escaneie o QR</div>
            <div className="text-caption text-muted-foreground text-center">
              WhatsApp &gt; Aparelhos conectados &gt; Conectar aparelho
            </div>
            <img
              src={qr}
              alt="QR Code"
              className="w-64 h-64 rounded-xl border border-border bg-white"
            />
            <div className="text-caption text-muted-foreground">
              Aguardando conexão… expira em {qrSecondsLeft}s
            </div>
            <button
              onClick={conectar}
              className="w-full h-10 rounded-2xl border border-border bg-card text-label"
            >
              Gerar novo QR
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusRow({
  label,
  state,
  text,
  hint,
}: {
  label: string;
  state: "ok" | "warn" | "off" | "unknown";
  text: string;
  hint?: string;
}) {
  const dot =
    state === "ok"
      ? "bg-success"
      : state === "warn"
        ? "bg-warning"
        : state === "off"
          ? "bg-muted-foreground/40"
          : "bg-muted-foreground/20";
  return (
    <div className="flex items-start gap-3">
      <span className={cn("mt-1.5 h-2.5 w-2.5 rounded-full shrink-0", dot)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-caption text-muted-foreground">{label}</span>
          <span className="text-label">{text}</span>
        </div>
        {hint ? (
          <div className="text-[11px] text-muted-foreground truncate">
            {hint}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/app/configuracoes/zapi")({
  component: ZapiConfig,
});
