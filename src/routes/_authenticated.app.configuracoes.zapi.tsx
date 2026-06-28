import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Smartphone, RefreshCw, Power, Lock } from "lucide-react";
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

type ZapiRemoteStatus = {
  connected?: boolean;
  connectedPhone?: string | null;
  webhookConfigured?: boolean;
  receivedWebhookConfigured?: boolean;
  receiveCallbackSentByMe?: boolean;
  webhooks?: {
    received?: string;
    delivery?: string;
    status?: string;
    connected?: string;
    disconnected?: string;
  };
  webhookMatches?: {
    received?: boolean;
    delivery?: boolean;
    status?: boolean;
    connected?: boolean;
    disconnected?: boolean;
  };
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

function ZapiConfig() {
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [qr, setQr] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
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
    refetchInterval: polling ? 3000 : false,
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

  // Poll status enquanto QR aberto
  useEffect(() => {
    if (!polling) return;
    const t = setInterval(async () => {
      const { data } = await supabase.functions.invoke(
        "zapi-instance-manager", { body: { action: "status" } },
      );
      if (data?.connected) {
        setPolling(false);
        setQr(null);
        toast.success("WhatsApp conectado!");
        qc.invalidateQueries({ queryKey: ["zapi-instance"] });
        qc.invalidateQueries({ queryKey: ["zapi-remote-status"] });
      }
    }, 3000);
    return () => clearInterval(t);
  }, [polling, qc]);

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
      const { error } = await supabase
        .from("zapi_instances")
        .insert(payload);
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
    const { data, error } = await supabase.functions.invoke(
      "zapi-instance-manager", { body: { action: "qr-code" } },
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
      setPolling(true);
    } else {
      toast.error("QR não recebido");
    }
  }

  async function desconectar() {
    const { error } = await supabase.functions.invoke(
      "zapi-instance-manager", { body: { action: "disconnect" } },
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
    const { error } = await supabase.functions.invoke(
      "zapi-instance-manager", { body: { action: "status" } },
    );
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    qc.invalidateQueries({ queryKey: ["zapi-instance"] });
    qc.invalidateQueries({ queryKey: ["zapi-remote-status"] });
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

  const webhooksOk = !!remoteStatus?.webhookConfigured;
  const phoneFromRemote = remoteStatus?.connectedPhone ?? null;

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


      {/* Status */}
      <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
        <span
          className={cn(
            "h-3 w-3 rounded-full",
            instance?.connected || remoteStatus?.connected
              ? "bg-success"
              : "bg-muted-foreground/40",
          )}
        />
        <div className="flex-1">
          <div className="text-label">
            {instance?.connected || remoteStatus?.connected ? "Conectado" : "Desconectado"}
          </div>
          <div className="text-caption text-muted-foreground">
            {instance?.phone_number || "Nenhum número vinculado"}
          </div>
        </div>
        <button
          onClick={atualizarStatus}
          className="h-9 w-9 inline-flex items-center justify-center rounded-full active:bg-muted/60"
          aria-label="Atualizar"
        >
          <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
        </button>
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
        {instance ? (
          <div className="rounded-xl bg-muted px-3 py-2 flex items-center gap-2">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                recebimentoAtivo ? "bg-success" : "bg-warning",
              )}
            />
            <div className="text-caption text-muted-foreground">
              {recebimentoAtivo
                ? "Recebimento de mensagens ativo"
                : "Recebimento de mensagens pendente"}
            </div>
          </div>
        ) : null}
        {qr ? (
          <div className="flex flex-col items-center gap-2">
            <img
              src={qr}
              alt="QR Code"
              className="w-64 h-64 rounded-xl border border-border bg-white"
            />
            <div className="text-caption text-muted-foreground text-center">
              Abra o WhatsApp &gt; Aparelhos conectados &gt; Conectar aparelho.
            </div>
          </div>
        ) : null}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={conectar}
            disabled={!instance}
            className="flex-1 h-11 rounded-2xl bg-primary text-primary-foreground text-label shadow-soft disabled:opacity-50"
          >
            {instance?.connected ? "Gerar novo QR" : "Conectar (QR)"}
          </button>
          {instance?.connected ? (
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
          disabled={!instance || !(instance.connected || remoteStatus?.connected)}
          className="h-11 rounded-2xl border border-border bg-card text-label disabled:opacity-50"
        >
          Ativar recebimento de mensagens
        </button>
      </div>

      {/* Webhook */}
      <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-2">
        <div className="text-label font-medium">URL de Webhook</div>
        <div className="text-caption text-muted-foreground">
          Cadastre esta URL no painel da Z-API em "Webhook · Ao receber":
        </div>
        <code className="block px-3 py-2 rounded-xl bg-muted text-[12px] break-all">
          {(import.meta.env.VITE_SUPABASE_URL || "") +
            "/functions/v1/zapi-webhook?token=<o token salvo nas variáveis do backend>"}
        </code>
        <div className="text-[11px] text-muted-foreground">
          O token vive como variável segura (ZAPI_WEBHOOK_TOKEN) — peça à equipe técnica.
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/app/configuracoes/zapi")({
  component: ZapiConfig,
});
