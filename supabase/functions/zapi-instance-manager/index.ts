// Gerencia instância Z-API (apenas admin): QR, status, webhooks, desconectar, restart
// Alinhado com https://developer.z-api.io
import {
  adminClient,
  buildWebhookUrl,
  corsHeaders,
  getActiveInstance,
  userClient,
  zapiBase,
  zapiHeaders,
} from "../_shared/zapi.ts";

type MeResponse = {
  connected?: boolean;
  phone?: string;
  connectedPhone?: string;
  phoneNumber?: string;
  receivedCallbackUrl?: string;
  deliveryCallbackUrl?: string;
  messageStatusCallbackUrl?: string;
  connectedCallbackUrl?: string;
  disconnectedCallbackUrl?: string;
  receiveCallbackSentByMe?: boolean;
};

function webhookStatusFromMe(me: MeResponse, expected: string | null) {
  const fields = {
    received: String(me.receivedCallbackUrl ?? ""),
    delivery: String(me.deliveryCallbackUrl ?? ""),
    status: String(me.messageStatusCallbackUrl ?? ""),
    connected: String(me.connectedCallbackUrl ?? ""),
    disconnected: String(me.disconnectedCallbackUrl ?? ""),
  };
  const matches = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, !!expected && v === expected]),
  );
  const allConfigured =
    !!expected && Object.values(matches).every(Boolean);
  return { fields, matches, allConfigured };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth)
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    const sbUser = userClient(auth);
    const { data: userData } = await sbUser.auth.getUser();
    if (!userData.user)
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const sb = adminClient();
    const { data: isAdmin } = await sb.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin)
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const url = new URL(req.url);
    let action = url.searchParams.get("action");
    let phoneParam: string | null = url.searchParams.get("phone");
    if (!action && (req.method === "POST" || req.method === "PUT")) {
      try {
        const body = await req.json();
        action = body?.action ?? null;
        phoneParam = body?.phone ?? phoneParam;
      } catch {
        // sem body
      }
    }
    if (!action) action = "status";

    const instance = await getActiveInstance();
    if (!instance) {
      return new Response(
        JSON.stringify({ error: "Nenhuma instância configurada" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const base = zapiBase(instance);
    const headers = zapiHeaders(instance);
    const webhookUrl = buildWebhookUrl();

    let path = "";
    let method = "GET";
    let zapiBody: Record<string, unknown> | undefined;
    switch (action) {
      case "status":
        path = "/status";
        break;
      case "me":
        path = "/me";
        break;
      case "configure-webhook":
        // PUT /update-every-webhooks aponta TODOS os callbacks
        // (received/delivery/status/connected/disconnected) para a mesma URL.
        if (!webhookUrl) {
          return new Response(
            JSON.stringify({ error: "Token do webhook não configurado" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        path = "/update-every-webhooks";
        method = "PUT";
        zapiBody = { value: webhookUrl, notifySentByMe: true };
        break;
      case "qr-code":
        path = "/qr-code/image";
        break;
      case "qr-bytes":
        path = "/qr-code";
        break;
      case "disconnect":
        path = "/disconnect";
        break;
      case "restart":
        path = "/restart";
        break;
      case "phone-code": {
        path = `/phone-code/${phoneParam}`;
        break;
      }
      default:
        return new Response(JSON.stringify({ error: "ação inválida" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: zapiBody ? JSON.stringify(zapiBody) : undefined,
    });
    const json = await res.json().catch(() => ({}));

    if (action === "status" && res.ok) {
      const connected = !!json.connected;
      const meRes = await fetch(`${base}/me`, { headers });
      const me = (await meRes.json().catch(() => ({}))) as MeResponse;
      const webhookStatus = webhookStatusFromMe(me, webhookUrl);
      await sb
        .from("zapi_instances")
        .update({
          connected,
          status: connected ? "connected" : json.session || "disconnected",
          phone_number:
            me.connectedPhone ??
            me.phone ??
            me.phoneNumber ??
            instance.phone_number,
        })
        .eq("id", instance.id);
      return new Response(
        JSON.stringify({
          ...json,
          connected,
          smartphoneConnected: !!json.smartphoneConnected,
          session: json.session ?? null,
          connectedPhone: me.connectedPhone ?? me.phone ?? null,
          webhooks: webhookStatus.fields,
          webhookMatches: webhookStatus.matches,
          webhookConfigured: webhookStatus.allConfigured,
          receivedWebhookConfigured: webhookStatus.matches.received,
          receiveCallbackSentByMe: !!me.receiveCallbackSentByMe,
          checkedAt: new Date().toISOString(),
        }),
        {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (action === "me" && res.ok) {
      const me = json as MeResponse;
      const webhookStatus = webhookStatusFromMe(me, webhookUrl);
      return new Response(
        JSON.stringify({
          connected: !!me.connected,
          connectedPhone: me.connectedPhone ?? me.phone ?? null,
          webhooks: webhookStatus.fields,
          webhookMatches: webhookStatus.matches,
          webhookConfigured: webhookStatus.allConfigured,
          receivedWebhookConfigured: webhookStatus.matches.received,
          receiveCallbackSentByMe: !!me.receiveCallbackSentByMe,
        }),
        {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (action === "configure-webhook" && res.ok) {
      return new Response(
        JSON.stringify({ ok: true, webhookConfigured: true, value: webhookUrl }),
        {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (action === "disconnect") {
      await sb
        .from("zapi_instances")
        .update({ connected: false, status: "disconnected" })
        .eq("id", instance.id);
    }

    return new Response(JSON.stringify(json), {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("zapi-instance-manager", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
