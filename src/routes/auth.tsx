import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Monogram } from "@/components/brand/Monogram";
import { SegmentedControl } from "@/components/brand/SegmentedControl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  resetPassword,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from "@/lib/auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Dra. Mabyan" },
      { name: "description", content: "Acesse o CRM da Dra. Mabyan." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUpWithEmail(email, password);
        toast.success("Conta criada. Verifique seu e-mail se necessário.");
      } else {
        await signInWithEmail(email, password);
        toast.success("Bem-vinda de volta.");
      }
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      // If popup flow, session is set — navigate. Full-page redirect returns here.
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao entrar com Google.");
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleForgot() {
    if (!email) {
      toast.error("Digite seu e-mail acima primeiro.");
      return;
    }
    try {
      await resetPassword(email);
      toast.success("Se houver conta, enviaremos um link.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar e-mail.");
    }
  }

  return (
    <div className="min-h-dvh surface-tint flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8 gap-3">
          <Monogram size={64} />
          <div>
            <h1 className="text-display text-foreground">Dra. Mabyan</h1>
            <p className="text-caption text-muted-foreground mt-1">
              Harmonização Facial
            </p>
          </div>
        </div>

        <div className="rounded-3xl bg-card shadow-soft p-6 border border-border/60">
          <div className="flex justify-center mb-5">
            <SegmentedControl
              value={mode}
              onChange={setMode}
              options={[
                { label: "Entrar", value: "signin" },
                { label: "Criar conta", value: "signup" },
              ]}
            />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full h-12 rounded-xl bg-card border border-border text-label text-foreground hover:border-primary/40 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GoogleMark className="h-4 w-4" />
            )}
            Continuar com Google
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-caption text-muted-foreground">ou</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-label text-foreground">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@clinica.com"
                className="h-12 rounded-xl bg-input border-border"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-label text-foreground">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="h-12 rounded-xl bg-input border-border"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-12 rounded-xl bg-primary text-primary-foreground text-label font-semibold shadow-soft hover:bg-primary-hover active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === "signup" ? "Criar conta" : "Entrar"}
            </button>

            {mode === "signin" ? (
              <button
                type="button"
                onClick={handleForgot}
                className="text-caption text-muted-foreground hover:text-primary transition-colors mt-1"
              >
                Esqueci minha senha
              </button>
            ) : null}
          </form>
        </div>

        <p className="text-center text-caption text-muted-foreground mt-6">
          <Link to="/style" className="hover:text-primary transition-colors">
            Ver Style Guide
          </Link>
        </p>
      </div>
    </div>
  );
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M23 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.16a5.27 5.27 0 0 1-2.29 3.46v2.88h3.7C21.7 18.78 23 15.83 23 12.27Z"
      />
      <path
        fill="#34A853"
        d="M12 23c3.1 0 5.7-1.03 7.6-2.78l-3.7-2.88c-1.03.69-2.34 1.1-3.9 1.1-3 0-5.55-2.02-6.46-4.74H1.7v2.97A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.54 13.7A6.6 6.6 0 0 1 5.18 12c0-.59.1-1.16.36-1.7V7.33H1.7A11 11 0 0 0 .5 12c0 1.77.42 3.44 1.2 4.94l3.84-3.24Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.74c1.69 0 3.2.58 4.4 1.71l3.28-3.28C17.7 1.2 15.1 0 12 0A11 11 0 0 0 1.7 7.33L5.54 10.3C6.45 7.58 9 4.74 12 4.74Z"
      />
    </svg>
  );
}
