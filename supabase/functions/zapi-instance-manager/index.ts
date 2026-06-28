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

    let path = "";
    switch (action) {
      case "status":
        path = "/status";
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
        const phone = url.searchParams.get("phone");
        path = `/phone-code/${phone}`;
        break;
      }
      default:
        return new Response(JSON.stringify({ error: "ação inválida" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const res = await fetch(`${base}${path}`, { headers });
    const json = await res.json().catch(() => ({}));

    // Sincroniza connected/phone_number quando status
    if (action === "status" && res.ok) {
      const connected = !!json.connected;
      await sb
        .from("zapi_instances")
        .update({
          connected,
          status: connected ? "connected" : json.session || "disconnected",
        })
        .eq("id", instance.id);
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
