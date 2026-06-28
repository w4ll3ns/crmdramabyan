// Gerencia instância Z-API (apenas admin): QR, status, desconectar, restart
import {
  adminClient,
  corsHeaders,
  getActiveInstance,
  userClient,
  zapiBase,
  zapiHeaders,
} from "../_shared/zapi.ts";

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

    const webhookToken = Deno.env.get("ZAPI_WEBHOOK_TOKEN");
    const webhookUrl = webhookToken
      ? `${Deno.env.get("SUPABASE_URL")}/functions/v1/zapi-webhook?token=${webhookToken}`
      : null;

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
        if (!webhookUrl) {
          return new Response(
            JSON.stringify({ error: "Token do webhook não configurado" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        path = "/update-webhook-received";
        method = "PUT";
        zapiBody = { value: webhookUrl };
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

    // Sincroniza connected/phone_number quando status
    if (action === "status" && res.ok) {
      const connected = !!json.connected;
      const meRes = await fetch(`${base}/me`, { headers });
      const meJson = await meRes.json().catch(() => ({}));
      const receivedCallbackUrl = String(meJson.receivedCallbackUrl ?? "");
      const receivedWebhookConfigured = !!(
        webhookUrl && receivedCallbackUrl === webhookUrl
      );
      await sb
        .from("zapi_instances")
        .update({
          connected,
          status: connected ? "connected" : json.session || "disconnected",
          phone_number: meJson.phone ?? meJson.phoneNumber ?? instance.phone_number,
        })
        .eq("id", instance.id);
      return new Response(
        JSON.stringify({
          ...json,
          connected,
          receivedWebhookConfigured,
          webhookConfigured: receivedWebhookConfigured,
        }),
        {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (action === "me" && res.ok) {
      const receivedCallbackUrl = String(json.receivedCallbackUrl ?? "");
      const receivedWebhookConfigured = !!(
        webhookUrl && receivedCallbackUrl === webhookUrl
      );
      return new Response(
        JSON.stringify({
          connected: !!json.connected,
          receivedWebhookConfigured,
          webhookConfigured: receivedWebhookConfigured,
          receiveCallbackSentByMe: !!json.receiveCallbackSentByMe,
        }),
        {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (action === "configure-webhook" && res.ok) {
      return new Response(
        JSON.stringify({ ok: true, receivedWebhookConfigured: true }),
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
