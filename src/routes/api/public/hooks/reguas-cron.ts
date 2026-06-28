import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/hooks/reguas-cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.CRON_SECRET;
        const provided = request.headers.get("x-cron-secret");
        if (!expected || provided !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const url = new URL(request.url);
        const job = url.searchParams.get("job");
        if (job !== "aniversario" && job !== "reativacao") {
          return new Response(JSON.stringify({ error: "unknown job" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const sb = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const fn = job === "aniversario" ? "run_regua_aniversario" : "run_regua_reativacao";
        const { data, error } = await sb.rpc(fn);
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true, processed: data }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
