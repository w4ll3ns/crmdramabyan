import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Monogram } from "@/components/brand/Monogram";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { updatePassword } from "@/lib/auth";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Redefinir senha — Dra. Mabyan" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase exchanges the recovery link for a session automatically when
    // it lands here. Wait for the session before allowing a password change.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await updatePassword(password);
      toast.success("Senha atualizada.");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh surface-tint flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8 gap-3">
          <Monogram size={64} />
          <h1 className="text-display text-foreground">Nova senha</h1>
          <p className="text-caption text-muted-foreground -mt-1">
            Defina uma senha para continuar.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl bg-card shadow-soft p-6 border border-border/60 flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password" className="text-label">
              Nova senha
            </Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="h-12 rounded-xl bg-input border-border"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !ready}
            className="h-12 rounded-xl bg-primary text-primary-foreground text-label font-semibold shadow-soft hover:bg-primary-hover active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {ready ? "Atualizar senha" : "Aguardando link…"}
          </button>
        </form>
      </div>
    </div>
  );
}
