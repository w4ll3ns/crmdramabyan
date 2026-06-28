import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Monogram } from "@/components/brand/Monogram";
import { SegmentedControl } from "@/components/brand/SegmentedControl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth } from "@/lib/auth";
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        await auth.signUp(email, password);
        toast.success("Conta criada com sucesso.");
      } else {
        await auth.signIn(email, password);
        toast.success("Bem-vinda de volta.");
      }
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot() {
    if (!email) {
      toast.error("Digite seu e-mail acima primeiro.");
      return;
    }
    try {
      await auth.resetPassword(email);
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
              className="h-12 rounded-xl bg-primary text-primary-foreground text-label font-semibold shadow-soft hover:bg-primary-hover active:scale-[0.99] transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2"
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
