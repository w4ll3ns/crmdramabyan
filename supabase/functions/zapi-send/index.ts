// Envia mensagem via Z-API e grava em messages (autenticada)
import {
  adminClient,
  corsHeaders,
  docExtensionFromMime,
  getActiveInstance,
  normalizePhone,
  userClient,
  zapiBase,
  zapiHeaders,
} from "../_shared/zapi.ts";

type SendBody = {
  conversation_id?: string;
  telefone?: string;
  type: "text" | "image" | "audio" | "video" | "document";
  content?: string;
  media_url?: string;
  media_mime_type?: string;
  filename?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sbUser = userClient(auth);
    const { data: userData } = await sbUser.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as SendBody;
    const sb = adminClient();

    let conversation: any = null;
    let telefone = normalizePhone(body.telefone ?? "");

    if (body.conversation_id) {
      const { data, error } = await sb
        .from("conversations")
        .select("*")
        .eq("id", body.conversation_id)
        .maybeSingle();
      if (error) throw error;
      conversation = data;
      if (conversation) telefone = normalizePhone(conversation.telefone);
    }

    if (!telefone) {
      return new Response(JSON.stringify({ error: "telefone obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!conversation && body.conversation_id) {
      return new Response(JSON.stringify({ error: "conversa inexistente" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Se não tem conversation_id, cria/recupera por telefone
    if (!conversation) {
      const { data: existing } = await sb
        .from("conversations")
        .select("*")
        .eq("telefone", telefone)
        .maybeSingle();
      if (existing) {
        conversation = existing;
      } else {
        const { data: created, error: cErr } = await sb
          .from("conversations")
          .insert({
            telefone,
            status: "em_atendimento",
            assigned_user_id: userData.user.id,
          })
          .select("*")
          .single();
        if (cErr) throw cErr;
        conversation = created;
      }
    }

    const instance = await getActiveInstance();
    if (!instance) {
      return new Response(
        JSON.stringify({ error: "Nenhuma instância Z-API configurada" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const base = zapiBase(instance);
    const headers = zapiHeaders(instance);
    let endpoint = "";
    let payload: Record<string, unknown> = { phone: telefone };

    switch (body.type) {
      case "text":
        endpoint = "/send-text";
        payload.message = body.content ?? "";
        break;
      case "image":
        endpoint = "/send-image";
        payload.image = body.media_url;
        if (body.content) payload.caption = body.content;
        break;
      case "audio":
        endpoint = "/send-audio";
        payload.audio = body.media_url;
        payload.waveform = true;
        payload.viewOnce = false;
        break;
      case "video":
        endpoint = "/send-video";
        payload.video = body.media_url;
        if (body.content) payload.caption = body.content;
        break;
      case "document": {
        const ext = docExtensionFromMime(body.media_mime_type, body.filename);
        endpoint = `/send-document/${ext}`;
        payload.document = body.media_url;
        payload.fileName = body.filename ?? `arquivo.${ext}`;
        break;
      }
    }

    const zRes = await fetch(`${base}${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const zJson = await zRes.json().catch(() => ({}));

    if (!zRes.ok) {
      return new Response(
        JSON.stringify({ error: "z-api falhou", details: zJson }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const externalId =
      zJson.messageId || zJson.id || zJson.zaapId || null;
    const now = new Date().toISOString();

    const { data: msg, error: mErr } = await sb
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        direction: "outbound",
        type: body.type,
        content_text: body.content ?? null,
        media_url: body.media_url ?? null,
        media_mime_type: body.media_mime_type ?? null,
        external_message_id: externalId,
        status: "enviado",
        sent_at: now,
      })
      .select("*")
      .single();
    if (mErr) throw mErr;

    await sb
      .from("conversations")
      .update({
        ultima_mensagem_em: now,
        status:
          conversation.status === "nao_lida"
            ? "em_atendimento"
            : conversation.status,
      })
      .eq("id", conversation.id);

    return new Response(
      JSON.stringify({ ok: true, message: msg, conversation }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("zapi-send error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
