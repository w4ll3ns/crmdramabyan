// Processa fila de mensagens agendadas (pg_cron a cada 5 min)
import {
  adminClient,
  corsHeaders,
  getActiveInstance,
  normalizePhone,
  zapiBase,
  zapiHeaders,
} from "../_shared/zapi.ts";

type Setting = { chave: string; valor: unknown };

function getSetting<T>(rows: Setting[], chave: string, def: T): T {
  const r = rows.find((x) => x.chave === chave);
  return (r?.valor as T) ?? def;
}

function nowInTz(tz: string): { hhmm: string; date: Date } {
  const date = new Date();
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
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

/** Próximo timestamp ISO do início da janela no fuso dado. */
function nextWindowStartISO(tz: string, janelaInicio: string): string {
  // calcula offset do fuso vs UTC para "hoje" e adiciona 1 dia se já passou
  const now = new Date();
  const [hh, mm] = janelaInicio.split(":").map((n) => parseInt(n, 10));
  // Constrói uma data "hoje" no fuso alvo às hh:mm
  const local = new Date(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now) + `T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`,
  );
  // ajusta para UTC subtraindo offset do fuso
  const tzOffsetMin = -getTzOffsetMinutes(tz, local);
  const utc = new Date(local.getTime() - tzOffsetMin * 60000);
  if (utc.getTime() <= now.getTime()) {
    utc.setUTCDate(utc.getUTCDate() + 1);
  }
  return utc.toISOString();
}

function getTzOffsetMinutes(tz: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(at).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const asUTC = Date.UTC(
    parseInt(parts.year),
    parseInt(parts.month) - 1,
    parseInt(parts.day),
    parseInt(parts.hour),
    parseInt(parts.minute),
    parseInt(parts.second),
  );
  return (asUTC - at.getTime()) / 60000;
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
    const pausado = getSetting<boolean>(rows, "automacoes_pausado", false);
    const janelaIni = getSetting<string>(rows, "automacoes_janela_inicio", "08:00");
    const janelaFim = getSetting<string>(rows, "automacoes_janela_fim", "20:00");
    const tz = getSetting<string>(rows, "automacoes_fuso", "America/Fortaleza");
    const limiteMin = getSetting<number>(rows, "automacoes_limite_minuto", 8);
    const nomeClinica = getSetting<string>(rows, "clinica_nome", "Clínica");

    if (pausado) {
      return new Response(JSON.stringify({ ok: true, skipped: "pausado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // 3) seleciona lote
    const lote = Math.max(1, Math.min(limiteMin * 5, 50));
    const { data: pendentes } = await sb
      .from("mensagens_agendadas")
      .select("*, modelo:modelos_mensagem(corpo), paciente:pacientes(id, nome, telefone, whatsapp, aceita_automacoes)")
      .eq("status", "pendente")
      .lte("agendado_para", new Date().toISOString())
      .order("agendado_para", { ascending: true })
      .limit(lote);

    if (!pendentes?.length) {
      return new Response(JSON.stringify({ ok: true, processadas: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const instance = await getActiveInstance();

    let enviadas = 0;
    let falhas = 0;
    let canceladas = 0;

    for (const m of pendentes as any[]) {
      // lock leve: tenta marcar status='enviada' condicional? mantemos simples via update no fim
      const paciente = m.paciente;
      if (!paciente) {
        await sb.from("mensagens_agendadas").update({
          status: "falhou", erro: "paciente inexistente", tentativas: (m.tentativas ?? 0) + 1,
        }).eq("id", m.id);
        falhas++;
        continue;
      }

      if (m.origem === "automacao" && paciente.aceita_automacoes === false) {
        await sb.from("mensagens_agendadas").update({
          status: "cancelada", erro: "opt-out", tentativas: (m.tentativas ?? 0) + 1,
        }).eq("id", m.id);
        canceladas++;
        continue;
      }

      let conteudo = (m.conteudo_renderizado ?? "").trim();
      if (!conteudo && m.modelo?.corpo) {
        const vars = { nome_clinica: nomeClinica, ...(m.variaveis ?? {}) };
        conteudo = renderTemplate(m.modelo.corpo, vars);
      }
      if (!conteudo) {
        await sb.from("mensagens_agendadas").update({
          status: "falhou", erro: "conteudo vazio", tentativas: (m.tentativas ?? 0) + 1,
        }).eq("id", m.id);
        falhas++;
        continue;
      }

      const telefone = normalizePhone(paciente.whatsapp || paciente.telefone || "");
      if (!telefone) {
        await sb.from("mensagens_agendadas").update({
          status: "falhou", erro: "telefone vazio", tentativas: (m.tentativas ?? 0) + 1,
        }).eq("id", m.id);
        falhas++;
        continue;
      }

      if (!instance) {
        await sb.from("mensagens_agendadas").update({
          status: "falhou", erro: "sem instância Z-API", tentativas: (m.tentativas ?? 0) + 1,
        }).eq("id", m.id);
        falhas++;
        continue;
      }

      // Envia direto via Z-API (sem passar pela edge zapi-send, que exige user auth)
      try {
        const resp = await fetch(`${zapiBase(instance)}/send-text`, {
          method: "POST",
          headers: zapiHeaders(instance),
          body: JSON.stringify({ phone: telefone, message: conteudo }),
        });
        if (!resp.ok) {
          const t = await resp.text().catch(() => "");
          throw new Error(`zapi ${resp.status}: ${t.slice(0, 200)}`);
        }
        const json = await resp.json().catch(() => ({}));
        const externalId = json?.messageId ?? json?.zaapId ?? json?.id ?? null;

        // Garante conversa
        let conversationId = m.conversation_id;
        if (!conversationId) {
          const { data: existing } = await sb
            .from("conversations")
            .select("id")
            .eq("telefone", telefone)
            .maybeSingle();
          if (existing) {
            conversationId = existing.id;
          } else {
            const { data: created } = await sb
              .from("conversations")
              .insert({
                telefone,
                paciente_id: paciente.id,
                status: "em_atendimento",
              })
              .select("id")
              .single();
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
          await sb.from("conversations").update({ ultima_mensagem_em: new Date().toISOString() }).eq("id", conversationId);
        }

        await sb.from("mensagens_agendadas").update({
          status: "enviada",
          enviada_em: new Date().toISOString(),
          tentativas: (m.tentativas ?? 0) + 1,
          conteudo_renderizado: conteudo,
          conversation_id: conversationId,
          erro: null,
        }).eq("id", m.id);
        enviadas++;
      } catch (e) {
        await sb.from("mensagens_agendadas").update({
          status: "falhou",
          erro: String((e as Error).message ?? e).slice(0, 500),
          tentativas: (m.tentativas ?? 0) + 1,
        }).eq("id", m.id);
        falhas++;
      }

      // anti-bloqueio: 2–6s
      await sleep(2000 + Math.floor(Math.random() * 4000));
    }

    return new Response(JSON.stringify({ ok: true, enviadas, falhas, canceladas }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
