// Recebe webhooks da Z-API (público, validado por token na query)
import {
  adminClient,
  corsHeaders,
  normalizePhone,
} from "../_shared/zapi.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const expected = Deno.env.get("ZAPI_WEBHOOK_TOKEN");
  if (!expected || token !== expected) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = adminClient();

  // Log bruto
  await sb.from("webhook_events").insert({
    source: "z-api",
    event_type: body.type ?? body.event ?? null,
    payload: body,
  });

  try {
    const eventType: string =
      body.type ?? body.event ?? body.notification ?? "";

    // === Status updates (delivery/read) ===
    if (
      /MessageStatus|delivery|read|DELIVERED|READ|SENT/i.test(eventType) ||
      body.status
    ) {
      const externalId =
        body.messageId || body.ids?.[0] || body.zaapId || body.id;
      const status = String(
        body.status || body.messageStatus || eventType || "",
      ).toLowerCase();
      if (externalId) {
        let mapped: string | null = null;
        if (/read/.test(status)) mapped = "lido";
        else if (/deliver/.test(status)) mapped = "entregue";
        else if (/sent/.test(status)) mapped = "enviado";
        if (mapped) {
          await sb
            .from("messages")
            .update({ status: mapped })
            .eq("external_message_id", externalId);
        }
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Mensagem recebida ===
    const fromMe = !!body.fromMe;
    if (fromMe) {
      return new Response(JSON.stringify({ ok: true, ignored: "fromMe" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phoneRaw: string =
      body.phone || body.from || body.sender || body.participantPhone || "";
    const telefone = normalizePhone(phoneRaw);
    if (!telefone) {
      return new Response(JSON.stringify({ ok: true, ignored: "noPhone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const nome =
      body.senderName || body.chatName || body.notifyName || telefone;
    const externalId = body.messageId || body.zaapId || body.id || null;

    // Detectar tipo + conteúdo
    let type: "text" | "image" | "audio" | "video" | "document" = "text";
    let content_text: string | null = null;
    let media_url: string | null = null;
    let media_mime_type: string | null = null;

    if (body.text?.message) {
      content_text = body.text.message;
    } else if (body.message?.text) {
      content_text = body.message.text;
    } else if (typeof body.message === "string") {
      content_text = body.message;
    }

    if (body.image) {
      type = "image";
      media_url = body.image.imageUrl || body.image.url || null;
      media_mime_type = body.image.mimeType || "image/jpeg";
      content_text = body.image.caption || content_text;
    } else if (body.audio) {
      type = "audio";
      media_url = body.audio.audioUrl || body.audio.url || null;
      media_mime_type = body.audio.mimeType || "audio/ogg";
    } else if (body.video) {
      type = "video";
      media_url = body.video.videoUrl || body.video.url || null;
      media_mime_type = body.video.mimeType || "video/mp4";
      content_text = body.video.caption || content_text;
    } else if (body.document) {
      type = "document";
      media_url = body.document.documentUrl || body.document.url || null;
      media_mime_type = body.document.mimeType || "application/pdf";
      content_text = body.document.fileName || content_text;
    }

    // Upsert paciente por telefone
    let pacienteId: string | null = null;
    const { data: pacExistente } = await sb
      .from("pacientes")
      .select("id")
      .or(`telefone.eq.${telefone},whatsapp.eq.${telefone}`)
      .limit(1)
      .maybeSingle();
    if (pacExistente) {
      pacienteId = pacExistente.id;
    } else {
      const { data: pacNovo, error: pErr } = await sb
        .from("pacientes")
        .insert({
          nome,
          telefone,
          whatsapp: telefone,
          origem: "whatsapp",
        })
        .select("id")
        .single();
      if (pErr) throw pErr;
      pacienteId = pacNovo.id;
    }

    // Upsert conversa por telefone
    let conversaId: string;
    const { data: convExistente } = await sb
      .from("conversations")
      .select("id, status")
      .eq("telefone", telefone)
      .maybeSingle();
    const now = new Date().toISOString();
    if (convExistente) {
      conversaId = convExistente.id;
      await sb
        .from("conversations")
        .update({
          ultima_mensagem_em: now,
          status:
            convExistente.status === "em_atendimento" ? "em_atendimento" : "nao_lida",
          paciente_id: pacienteId,
        })
        .eq("id", conversaId);
    } else {
      const { data: convNova, error: cErr } = await sb
        .from("conversations")
        .insert({
          telefone,
          paciente_id: pacienteId,
          status: "nao_lida",
          ultima_mensagem_em: now,
        })
        .select("id")
        .single();
      if (cErr) throw cErr;
      conversaId = convNova.id;
    }

    await sb.from("messages").insert({
      conversation_id: conversaId,
      direction: "inbound",
      type,
      content_text,
      media_url,
      media_mime_type,
      external_message_id: externalId,
      status: null,
      sent_at: now,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("zapi-webhook error", e);
    await sb.from("webhook_events").insert({
      source: "z-api",
      event_type: "error",
      payload: { error: String(e), original: body },
      error: String(e),
    });
    return new Response(JSON.stringify({ ok: true, error: String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
