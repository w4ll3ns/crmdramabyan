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
