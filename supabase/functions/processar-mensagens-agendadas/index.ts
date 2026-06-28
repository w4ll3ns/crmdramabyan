// Processa fila de mensagens agendadas (pg_cron a cada 5 min)
// Endurecido conforme doc Z-API: delays nativos, claim atômico, teto de
// destinatários distintos por hora/dia e circuit breaker de shadowban.
import {
  adminClient,
  corsHeaders,
  getActiveInstance,
  normalizePhone,
  zapiBase,
  zapiHeaders,
} from "../_shared/zapi.ts";

type Setting = { chave: string; valor: unknown };
type PausaAuto = { ativo?: boolean; motivo?: string | null; desde?: string | null };

const SHADOWBAN_PATTERNS = [
  "shadow ban",
  "shadowban",
  "did not have permission to send this message",
  "whatsapp rejected sending this message",
];

function getSetting<T>(rows: Setting[], chave: string, def: T): T {
  const r = rows.find((x) => x.chave === chave);
  return (r?.valor as T) ?? def;
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function randInt(min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.floor(lo + Math.random() * (hi - lo + 1));
}

function detectShadowban(text: string | null | undefined): string | null {
  if (!text) return null;
  const low = text.toLowerCase();
  for (const p of SHADOWBAN_PATTERNS) {
    if (low.includes(p)) return p;
  }
  return null;
}

function nowInTz(tz: string): { hhmm: string; date: Date } {
  const date = new Date();
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  });
  return { hhmm: fmt.format(date), date };
}

function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(":").map((n) => parseInt(n, 10));
  return h * 60 + m;
}

function renderTemplate(corpo: string, vars: Record<string, unknown>): string {
  let out = corpo || "";
  for (const [k, v] of Object.entries(vars || {})) {
    out = out.replaceAll(`{{${k}}}`, String(v ?? ""));
  }
  return out;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function getTzOffsetMinutes(tz: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(at).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const asUTC = Date.UTC(
    parseInt(parts.year), parseInt(parts.month) - 1, parseInt(parts.day),
    parseInt(parts.hour), parseInt(parts.minute), parseInt(parts.second),
  );
  return (asUTC - at.getTime()) / 60000;
}

function nextWindowStartISO(tz: string, janelaInicio: string): string {
  const now = new Date();
  const [hh, mm] = janelaInicio.split(":").map((n) => parseInt(n, 10));
  const local = new Date(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(now) + `T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`,
  );
  const tzOffsetMin = -getTzOffsetMinutes(tz, local);
  const utc = new Date(local.getTime() - tzOffsetMin * 60000);
  if (utc.getTime() <= now.getTime()) {
    utc.setUTCDate(utc.getUTCDate() + 1);
  }
  return utc.toISOString();
}

/** Data "hoje" no fuso, como string YYYY-MM-DD. */
function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

async function ativarPausaAutoShadowban(
  sb: ReturnType<typeof adminClient>,
  motivo: string,
) {
  const valor = { ativo: true, motivo, desde: new Date().toISOString() };
  await sb.from("settings").upsert(
    { chave: "automacoes_pausa_auto", valor: valor as never },
    { onConflict: "chave" },
  );
  // Dedup: só uma task de alerta a cada 6h.
  const desde = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
  const { data: existing } = await sb
    .from("tasks")
    .select("id")
    .eq("titulo", "Possível shadowban Z-API — automações pausadas")
    .gt("created_at", desde)
    .maybeSingle();
  if (!existing) {
    await sb.from("tasks").insert({
      titulo: "Possível shadowban Z-API — automações pausadas",
      descricao:
        `O envio automático foi pausado porque o WhatsApp/Z-API retornou: "${motivo}". ` +
        `Insistir piora o bloqueio. Verifique o número, reduza volume e retome manualmente no painel de Automações.`,
      prioridade: "alta",
      status: "pendente",
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const expectedCronSecret = Deno.env.get("CRON_SECRET");
  const providedCronSecret = req.headers.get("x-cron-secret");
  if (!expectedCronSecret || providedCronSecret !== expectedCronSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const sb = adminClient();

    // 1) settings
    const { data: settingsRows } = await sb.from("settings").select("chave, valor");
    const rows = (settingsRows ?? []) as Setting[];

    const pausadoManual = !!getSetting<boolean>(rows, "automacoes_pausado", false);
    const pausaAuto = getSetting<PausaAuto>(rows, "automacoes_pausa_auto",
      { ativo: false, motivo: null, desde: null });
    const cooldownH = Number(getSetting<number>(rows, "automacoes_shadowban_cooldown_horas", 6)) || 6;

    // Limpa pausa automática se cooldown expirou
    if (pausaAuto?.ativo && pausaAuto.desde) {
      const desdeMs = new Date(pausaAuto.desde).getTime();
      if (Number.isFinite(desdeMs) && Date.now() - desdeMs > cooldownH * 3600 * 1000) {
        await sb.from("settings").upsert(
          { chave: "automacoes_pausa_auto", valor: { ativo: false, motivo: null, desde: null } as never },
          { onConflict: "chave" },
        );
        pausaAuto.ativo = false;
      }
    }

    if (pausadoManual) {
      return new Response(JSON.stringify({ ok: true, skipped: "pausado_manual" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (pausaAuto?.ativo) {
      return new Response(JSON.stringify({ ok: true, skipped: "pausa_auto_shadowban", motivo: pausaAuto.motivo }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const janelaIni = getSetting<string>(rows, "automacoes_janela_inicio", "08:00");
    const janelaFim = getSetting<string>(rows, "automacoes_janela_fim", "20:00");
    const tz = getSetting<string>(rows, "automacoes_fuso", "America/Fortaleza");
    const limiteMin = Number(getSetting<number>(rows, "automacoes_limite_minuto", 8)) || 8;
    const nomeClinica = getSetting<string>(rows, "clinica_nome", "Clínica");

    const dTypMin = clampInt(Number(getSetting<number>(rows, "zapi_delay_typing_min", 3)), 1, 15);
    const dTypMax = clampInt(Number(getSetting<number>(rows, "zapi_delay_typing_max", 6)), 1, 15);
    const dMsgMin = clampInt(Number(getSetting<number>(rows, "zapi_delay_message_min", 2)), 1, 15);
    const dMsgMax = clampInt(Number(getSetting<number>(rows, "zapi_delay_message_max", 4)), 1, 15);
    const maxHora = Number(getSetting<number>(rows, "zapi_max_destinatarios_hora", 15)) || 15;
    const maxDia  = Number(getSetting<number>(rows, "zapi_max_destinatarios_dia", 40)) || 40;

    // 2) janela
    const { hhmm } = nowInTz(tz);
    const cur = hhmmToMinutes(hhmm);
    const ini = hhmmToMinutes(janelaIni);
    const fim = hhmmToMinutes(janelaFim);
    const dentroJanela = cur >= ini && cur < fim;

    if (!dentroJanela) {
      const proxIni = nextWindowStartISO(tz, janelaIni);
      const { data: pend } = await sb
        .from("mensagens_agendadas")
        .select("id")
        .eq("status", "pendente")
        .lte("agendado_para", new Date().toISOString());
      const ids = (pend ?? []).map((r: any) => r.id);
      if (ids.length) {
        await sb.from("mensagens_agendadas")
          .update({ agendado_para: proxIni })
          .in("id", ids);
      }
      return new Response(JSON.stringify({ ok: true, reagendadas: ids.length, proxIni }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) destinatários distintos já enviados (hora/dia, fuso de settings)
    const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
    const today = todayInTz(tz);
    const dayStart = new Date(`${today}T00:00:00`);
    const tzOff = -getTzOffsetMinutes(tz, dayStart);
    const dayStartUtcIso = new Date(dayStart.getTime() - tzOff * 60000).toISOString();

    const { data: enviadasHoraRows } = await sb
      .from("mensagens_agendadas").select("paciente_id")
      .eq("status", "enviada").gte("enviada_em", oneHourAgo);
    const { data: enviadasDiaRows } = await sb
      .from("mensagens_agendadas").select("paciente_id")
      .eq("status", "enviada").gte("enviada_em", dayStartUtcIso);

    const setHora = new Set<string>((enviadasHoraRows ?? []).map((r: any) => r.paciente_id).filter(Boolean));
    const setDia  = new Set<string>((enviadasDiaRows ?? []).map((r: any) => r.paciente_id).filter(Boolean));

    // 4) tamanho de lote: cada envio gasta ~ (dTyp + dMsg + gap 4s). Cap em 8.
    const ciclo = dTypMax + dMsgMax + 6;
    const fit = Math.max(1, Math.floor(240 / Math.max(1, ciclo)));
    const lote = Math.max(1, Math.min(limiteMin * 5, fit, 10));

    // 5) claim atômico
    const { data: claimed, error: claimErr } = await sb
      .rpc("claim_mensagens_pendentes", { _limit: lote });
    if (claimErr) throw claimErr;
    const claimedRows = (claimed ?? []) as any[];

    if (!claimedRows.length) {
      return new Response(JSON.stringify({ ok: true, processadas: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Hidrata paciente + modelo das linhas reivindicadas
    const idsClaim = claimedRows.map((r) => r.id);
    const { data: hydrated } = await sb
      .from("mensagens_agendadas")
      .select("*, modelo:modelos_mensagem(corpo), paciente:pacientes(id, nome, telefone, whatsapp, aceita_automacoes)")
      .in("id", idsClaim);

    const instance = await getActiveInstance();

    let enviadas = 0, falhas = 0, canceladas = 0, reagendadas = 0;
    let shadowbanned: string | null = null;

    for (const m of (hydrated ?? []) as any[]) {
      if (shadowbanned) {
        // devolve restante para pendente, sem incrementar tentativas
        await sb.rpc("reagendar_mensagem", {
          _id: m.id, _nova: new Date(Date.now() + 60000).toISOString(),
        });
        continue;
      }

      const paciente = m.paciente;
      if (!paciente) {
        await sb.from("mensagens_agendadas").update({
          status: "falhou", erro: "paciente inexistente",
        }).eq("id", m.id);
        falhas++; continue;
      }

      if (m.origem === "automacao" && paciente.aceita_automacoes === false) {
        await sb.from("mensagens_agendadas").update({
          status: "cancelada", erro: "opt-out",
        }).eq("id", m.id);
        canceladas++; continue;
      }

      // Teto de destinatários distintos
      const pid = paciente.id;
      const jaContaHora = setHora.has(pid);
      const jaContaDia  = setDia.has(pid);
      if (!jaContaDia && setDia.size >= maxDia) {
        await sb.rpc("reagendar_mensagem", {
          _id: m.id, _nova: nextWindowStartISO(tz, janelaIni),
        });
        reagendadas++; continue;
      }
      if (!jaContaHora && setHora.size >= maxHora) {
        const nova = new Date(Date.now() + 3600 * 1000).toISOString();
        await sb.rpc("reagendar_mensagem", { _id: m.id, _nova: nova });
        reagendadas++; continue;
      }

      let conteudo = (m.conteudo_renderizado ?? "").trim();
      if (!conteudo && m.modelo?.corpo) {
        const vars = { nome_clinica: nomeClinica, ...(m.variaveis ?? {}) };
        conteudo = renderTemplate(m.modelo.corpo, vars);
      }
      if (!conteudo) {
        await sb.from("mensagens_agendadas").update({
          status: "falhou", erro: "conteudo vazio",
        }).eq("id", m.id);
        falhas++; continue;
      }

      const telefone = normalizePhone(paciente.whatsapp || paciente.telefone || "");
      if (!telefone) {
        await sb.from("mensagens_agendadas").update({
          status: "falhou", erro: "telefone vazio",
        }).eq("id", m.id);
        falhas++; continue;
      }

      if (!instance) {
        await sb.from("mensagens_agendadas").update({
          status: "falhou", erro: "sem instância Z-API",
        }).eq("id", m.id);
        falhas++; continue;
      }

      const delayTyping  = clampInt(randInt(dTypMin, dTypMax), 1, 15);
      const delayMessage = clampInt(randInt(dMsgMin, dMsgMax), 1, 15);

      try {
        const resp = await fetch(`${zapiBase(instance)}/send-text`, {
          method: "POST",
          headers: zapiHeaders(instance),
          body: JSON.stringify({
            phone: telefone,
            message: conteudo,
            delayTyping,
            delayMessage,
          }),
        });
        const raw = await resp.text();
        let json: any = {};
        try { json = raw ? JSON.parse(raw) : {}; } catch { /* noop */ }

        const errorText = [
          !resp.ok ? `zapi ${resp.status}` : "",
          json?.error, json?.message, json?.errorDescription, json?.statusDescription,
          raw && raw.length < 500 ? raw : "",
        ].filter(Boolean).join(" | ");

        const sb_hit = detectShadowban(errorText) || detectShadowban(raw);

        if (!resp.ok || sb_hit) {
          await sb.from("mensagens_agendadas").update({
            status: "falhou",
            erro: (errorText || `zapi ${resp.status}`).slice(0, 500),
          }).eq("id", m.id);
          falhas++;
          if (sb_hit) {
            shadowbanned = sb_hit;
            await ativarPausaAutoShadowban(sb, sb_hit);
            break;
          }
          continue;
        }

        const externalId = json?.messageId ?? json?.zaapId ?? json?.id ?? null;

        // Garante conversa
        let conversationId = m.conversation_id;
        if (!conversationId) {
          const { data: existing } = await sb
            .from("conversations").select("id").eq("telefone", telefone).maybeSingle();
          if (existing) conversationId = existing.id;
          else {
            const { data: created } = await sb
              .from("conversations")
              .insert({ telefone, paciente_id: paciente.id, status: "em_atendimento" })
              .select("id").single();
            conversationId = created?.id ?? null;
          }
        }

        if (conversationId) {
          await sb.from("messages").insert({
            conversation_id: conversationId,
            direction: "outbound",
            type: "text",
            content_text: conteudo,
            status: "enviado",
            external_message_id: externalId,
            sent_at: new Date().toISOString(),
          });
          await sb.from("conversations")
            .update({ ultima_mensagem_em: new Date().toISOString() })
            .eq("id", conversationId);
        }

        await sb.from("mensagens_agendadas").update({
          status: "enviada",
          enviada_em: new Date().toISOString(),
          conteudo_renderizado: conteudo,
          conversation_id: conversationId,
          erro: null,
        }).eq("id", m.id);

        setHora.add(pid);
        setDia.add(pid);
        enviadas++;
      } catch (e) {
        const msg = String((e as Error).message ?? e);
        const sb_hit = detectShadowban(msg);
        await sb.from("mensagens_agendadas").update({
          status: "falhou", erro: msg.slice(0, 500),
        }).eq("id", m.id);
        falhas++;
        if (sb_hit) {
          shadowbanned = sb_hit;
          await ativarPausaAutoShadowban(sb, sb_hit);
          break;
        }
      }

      // gap aleatório 2–6s ALÉM dos delays nativos da Z-API
      await sleep(2000 + Math.floor(Math.random() * 4000));
    }

    return new Response(JSON.stringify({
      ok: true, enviadas, falhas, canceladas, reagendadas,
      shadowban: shadowbanned ? { detected: true, motivo: shadowbanned } : false,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
