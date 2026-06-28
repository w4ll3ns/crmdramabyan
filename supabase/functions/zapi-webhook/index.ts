// Recebe webhooks da Z-API (público, validado por token na query).
// Cobre: ReceivedCallback, DeliveryCallback, MessageStatusCallback,
// ConnectedCallback e DisconnectedCallback.
// Refs: https://developer.z-api.io/webhooks/*
import {
  adminClient,
  corsHeaders,
  extractExternalId,
  normalizePhone,
} from "../_shared/zapi.ts";

type MessageType = "text" | "image" | "audio" | "video" | "document";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

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
  const eventType: string =
    body.type ?? body.event ?? body.notification ?? "";

  // Log bruto
  await sb.from("webhook_events").insert({
    source: "z-api",
    event_type: eventType || null,
    payload: body,
  });

  try {
    // === Conexão / desconexão da instância ===
    if (/connected/i.test(eventType) && !/disconnect/i.test(eventType)) {
      const phone = normalizePhone(
        body.connectedPhone || body.phone || body.phoneNumber || "",
      );
      await sb
        .from("zapi_instances")
        .update({
          connected: true,
          status: "connected",
          ...(phone ? { phone_number: phone } : {}),
        })
        .eq("instance_id", body.instanceId ?? "")
        .then(async (r) => {
          // Fallback: se não tem instanceId no payload, atualiza a única instância
          if (!body.instanceId) {
            await sb
              .from("zapi_instances")
              .update({ connected: true, status: "connected" })
              .neq("id", "");
          }
          return r;
        });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (/disconnect/i.test(eventType)) {
      await sb
        .from("zapi_instances")
        .update({ connected: false, status: "disconnected" })
        .eq("instance_id", body.instanceId ?? "")
        .then(async (r) => {
          if (!body.instanceId) {
            await sb
              .from("zapi_instances")
              .update({ connected: false, status: "disconnected" })
              .neq("id", "");
          }
          return r;
        });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isReceivedMessageEvent = /ReceivedCallback/i.test(eventType);

    // === Delivery / status de mensagens (SENT|RECEIVED|READ|PLAYED) ===
    // Importante: ReceivedCallback também vem com body.status = "RECEIVED".
    // Se cair aqui, a mensagem recebida é confundida com status e nunca é inserida.
    if (
      !isReceivedMessageEvent &&
      (/MessageStatus|DeliveryCallback|delivery|read|DELIVERED|READ|SENT|PLAYED/i.test(
        eventType,
      ) ||
        body.messageStatus)
    ) {
      const ids: string[] = Array.isArray(body.ids)
        ? body.ids
        : [extractExternalId(body)].filter(Boolean) as string[];
      const status = String(
        body.status || body.messageStatus || eventType || "",
      ).toLowerCase();
      let mapped: string | null = null;
      if (/read|played/.test(status)) mapped = "lido";
      else if (/deliver|received/.test(status)) mapped = "entregue";
      else if (/sent/.test(status)) mapped = "enviado";
      if (mapped && ids.length) {
        await sb
          .from("messages")
          .update({ status: mapped })
          .in("external_message_id", ids);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Mensagem recebida (ReceivedCallback) ===
    // Ignora grupos/canais por enquanto (não casamos com paciente).
    if (!isReceivedMessageEvent) {
      await sb.from("webhook_events").insert({
        source: "z-api",
        event_type: "ignored_unsupported_event",
        payload: { eventType, original: body },
      });
      return new Response(
        JSON.stringify({ ok: true, ignored: "unsupported_event", eventType }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (body.isGroup || body.isNewsletter) {
      return new Response(
        JSON.stringify({ ok: true, ignored: "group_or_newsletter" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const fromMe = !!body.fromMe;
    const phoneRaw: string =
      body.phone || body.from || body.sender || body.participantPhone || "";
    const telefone = normalizePhone(phoneRaw);
    if (!telefone) {
      await sb.from("webhook_events").insert({
        source: "z-api",
        event_type: "ignored_no_phone",
        payload: body,
      });
      return new Response(JSON.stringify({ ok: true, ignored: "noPhone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const nome =
      body.senderName || body.chatName || body.notifyName || telefone;
    const senderPhoto: string | null = body.senderPhoto || body.photo || null;
    const externalId = extractExternalId(body);
    const momentMs = Number(body.momment ?? body.moment ?? 0);
    const sentAtIso =
      momentMs > 0 ? new Date(momentMs).toISOString() : new Date().toISOString();

    // === Reações: atualiza a mensagem alvo, não cria nova ===
    if (body.reaction || body.reactionMessage) {
      const reaction = body.reaction ?? body.reactionMessage ?? {};
      const refId =
        reaction.referencedMessage?.messageId ??
        reaction.referencedMessageId ??
        reaction.messageId ??
        null;
      const emoji = reaction.value ?? reaction.reaction ?? "";
      if (refId) {
        const { data: target } = await sb
          .from("messages")
          .select("id, content_text, type")
          .eq("external_message_id", refId)
          .maybeSingle();
        if (target) {
          const base = (target.content_text ?? "").replace(/\s*[•]\s*reação:.*$/u, "");
          await sb
            .from("messages")
            .update({
              content_text: emoji
                ? `${base}${base ? " " : ""}• reação: ${emoji}`
                : base,
            })
            .eq("id", target.id);
        }
      }
      return new Response(JSON.stringify({ ok: true, reaction: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dedup por external_message_id
    if (externalId) {
      const { data: existing } = await sb
        .from("messages")
        .select("id")
        .eq("external_message_id", externalId)
        .maybeSingle();
      if (existing) {
        return new Response(
          JSON.stringify({ ok: true, ignored: "duplicate" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Detectar tipo + conteúdo (enum suporta text|image|audio|video|document)
    let type: MessageType = "text";
    let content_text: string | null = null;
    let media_url: string | null = null;
    let media_mime_type: string | null = null;

    if (body.text?.message) content_text = body.text.message;
    else if (body.message?.text) content_text = body.message.text;
    else if (typeof body.message === "string") content_text = body.message;

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
    } else if (body.sticker) {
      // Mapeia sticker como image (enum não tem sticker dedicado)
      type = "image";
      media_url = body.sticker.stickerUrl || body.sticker.url || null;
      media_mime_type = body.sticker.mimeType || "image/webp";
      content_text = content_text || "🟦 figurinha";
    } else if (body.location) {
      // Mapeia location como text descritivo
      const { latitude, longitude, name, address } = body.location;
      content_text = [
        `📍 ${latitude},${longitude}`,
        name,
        address,
      ]
        .filter(Boolean)
        .join(" — ");
    } else if (body.contact || body.contacts) {
      const c = body.contact ?? body.contacts?.[0] ?? {};
      content_text = `👤 ${c.displayName || c.name || ""} ${c.phones?.[0]?.phone || c.phone || ""}`.trim();
    } else if (body.poll) {
      const options = (body.poll.options || [])
        .map((o: any) => `• ${o.name ?? o.text ?? o}`)
        .join("\n");
      content_text = `📊 ${body.poll.name ?? body.poll.question ?? "Enquete"}\n${options}`;
    }

    // Upsert paciente por telefone (somente para mensagens recebidas)
    let pacienteId: string | null = null;
    if (!fromMe) {
      const { data: pacExistente } = await sb
        .from("pacientes")
        .select("id, foto_url")
        .or(`telefone.eq.${telefone},whatsapp.eq.${telefone}`)
        .limit(1)
        .maybeSingle();
      if (pacExistente) {
        pacienteId = pacExistente.id;
        if (senderPhoto && !pacExistente.foto_url) {
          await sb
            .from("pacientes")
            .update({ foto_url: senderPhoto })
            .eq("id", pacienteId);
        }
      } else {
        const { data: pacNovo, error: pErr } = await sb
          .from("pacientes")
          .insert({
            nome,
            telefone,
            whatsapp: telefone,
            origem: "whatsapp",
            ...(senderPhoto ? { foto_url: senderPhoto } : {}),
          })
          .select("id")
          .single();
        if (pErr) throw pErr;
        pacienteId = pacNovo.id;
      }
    } else {
      // Para fromMe, tenta achar o paciente existente (não cria a partir do próprio número)
      const { data: pac } = await sb
        .from("pacientes")
        .select("id")
        .or(`telefone.eq.${telefone},whatsapp.eq.${telefone}`)
        .limit(1)
        .maybeSingle();
      pacienteId = pac?.id ?? null;
    }

    // Upsert conversa por telefone
    let conversaId: string;
    const { data: convExistente } = await sb
      .from("conversations")
      .select("id, status")
      .eq("telefone", telefone)
      .maybeSingle();
    if (convExistente) {
      conversaId = convExistente.id;
      await sb
        .from("conversations")
        .update({
          ultima_mensagem_em: sentAtIso,
          status: fromMe
            ? convExistente.status
            : convExistente.status === "em_atendimento"
              ? "em_atendimento"
              : "nao_lida",
          ...(pacienteId ? { paciente_id: pacienteId } : {}),
        })
        .eq("id", conversaId);
    } else {
      const { data: convNova, error: cErr } = await sb
        .from("conversations")
        .insert({
          telefone,
          paciente_id: pacienteId,
          status: fromMe ? "em_atendimento" : "nao_lida",
          ultima_mensagem_em: sentAtIso,
        })
        .select("id")
        .single();
      if (cErr) throw cErr;
      conversaId = convNova.id;
    }

    await sb.from("messages").insert({
      conversation_id: conversaId,
      direction: fromMe ? "outbound" : "inbound",
      type,
      content_text,
      media_url,
      media_mime_type,
      external_message_id: externalId,
      status: fromMe ? "enviado" : null,
      sent_at: sentAtIso,
    });

    // Opt-out: se inbound text contém palavra-chave configurada, marca paciente
    if (!fromMe && type === "text" && content_text && pacienteId) {
      try {
        const { data: setting } = await sb
          .from("settings")
          .select("valor")
          .eq("chave", "automacoes_palavra_optout")
          .maybeSingle();
        const palavra = String(setting?.valor ?? "sair").toLowerCase().trim();
        if (palavra && content_text.toLowerCase().trim() === palavra) {
          await sb.from("pacientes").update({ aceita_automacoes: false }).eq("id", pacienteId);
          await sb
            .from("mensagens_agendadas")
            .update({ status: "cancelada", erro: "opt-out" })
            .eq("paciente_id", pacienteId)
            .eq("status", "pendente")
            .eq("origem", "automacao");
        }
      } catch (e) {
        console.error("opt-out check failed", e);
      }
    }

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
