// Helpers compartilhados Z-API
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export function userClient(authHeader: string | null) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
      Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      auth: { persistSession: false },
      global: { headers: authHeader ? { Authorization: authHeader } : {} },
    },
  );
}

export async function getActiveInstance() {
  const sb = adminClient();
  const { data, error } = await sb
    .from("zapi_instances")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function zapiBase(instance: { instance_id: string; token: string }) {
  return `https://api.z-api.io/instances/${instance.instance_id}/token/${instance.token}`;
}

export function zapiHeaders(instance: { client_token: string | null }) {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (instance.client_token) h["Client-Token"] = instance.client_token;
  return h;
}

export function normalizePhone(phone: string) {
  return (phone || "").replace(/\D/g, "");
}

/** True quando o valor é um identificador LID do WhatsApp (ex.: "12345@lid"). */
export function isLid(value: string | null | undefined): boolean {
  return !!value && /@lid$/i.test(String(value));
}

/** Extrai a parte numérica do LID; retorna null se não houver. */
export function lidDigits(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = String(value).match(/^(\d+)@lid$/i);
  return m ? m[1] : null;
}

/**
 * Tenta resolver um LID do WhatsApp para o telefone real via Z-API.
 * Faz fallback por múltiplos endpoints conhecidos da Z-API.
 * Retorna o telefone normalizado (somente dígitos) ou null se não resolver.
 */
export async function resolveLidToPhone(
  lid: string,
  instance: { instance_id: string; token: string; client_token: string | null },
): Promise<string | null> {
  const digits = lidDigits(lid) ?? normalizePhone(lid);
  if (!digits) return null;
  const base = zapiBase(instance);
  const headers = zapiHeaders(instance);
  const candidates = [
    `${base}/lid-to-phone/${digits}`,
    `${base}/phone-from-lid/${digits}`,
    `${base}/chat-metadata/${digits}@lid`,
    `${base}/chat-metadata/${digits}`,
  ];
  for (const url of candidates) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(url, { headers, signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) continue;
      const j: any = await r.json().catch(() => null);
      if (!j) continue;
      const phone =
        j.phone ?? j.number ?? j.realPhone ?? j.userPhone ?? j.id ?? null;
      const norm = normalizePhone(String(phone ?? ""));
      if (norm && norm !== digits) return norm;
    } catch (_e) {
      // tenta o próximo
    }
  }
  return null;
}

/** URL pública (HTTPS) do nosso webhook único Z-API. */
export function buildWebhookUrl(): string | null {
  const token = Deno.env.get("ZAPI_WEBHOOK_TOKEN");
  const base = Deno.env.get("SUPABASE_URL");
  if (!token || !base) return null;
  return `${base}/functions/v1/zapi-webhook?token=${token}`;
}

/** Identificador externo de mensagem, conforme variações da Z-API. */
export function extractExternalId(body: any): string | null {
  return (
    body?.messageId ??
    body?.zaapId ??
    body?.id ??
    (Array.isArray(body?.ids) ? body.ids[0] : null) ??
    null
  );
}

/** Deriva a extensão (sem ponto) para o endpoint /send-document/{ext}. */
export function docExtensionFromMime(
  mime: string | null | undefined,
  filename: string | null | undefined,
): string {
  const fromName = filename?.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      "pptx",
    "text/plain": "txt",
    "text/csv": "csv",
    "application/zip": "zip",
  };
  return (mime && map[mime]) || "pdf";
}
