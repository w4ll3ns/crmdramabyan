import { createFileRoute, Link } from "@tanstack/react-router";
import { Zap, Smartphone, ChevronRight, Settings, ShieldAlert, Variable } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export const Route = createFileRoute("/_authenticated/app/configuracoes/")({
  component: ConfiguracoesIndex,
});

function ConfiguracoesIndex() {
  const isAdmin = useIsAdmin();

  return (
    <>
      <section className="px-5 pt-6 pb-2">
        <p className="text-caption text-muted-foreground">Sistema</p>
        <h1 className="text-display text-foreground mt-1 flex items-center gap-2">
          <Settings className="h-7 w-7" strokeWidth={1.5} />
          Configurações
        </h1>
        <p className="text-caption text-muted-foreground mt-2 max-w-sm">
          Ajuste integrações, automações e preferências da clínica.
        </p>
      </section>

      {isAdmin === false ? (
        <div className="mx-5 mt-3 rounded-2xl bg-card shadow-soft p-4 flex gap-3 items-start border border-warning/30">
          <ShieldAlert className="h-5 w-5 text-warning mt-0.5" strokeWidth={1.5} />
          <div>
            <div className="text-label">Acesso limitado</div>
            <p className="text-caption text-muted-foreground mt-1">
              Sua conta não tem o papel <strong>admin</strong>. Algumas seções
              podem estar bloqueadas. Peça a um administrador para atribuir a
              permissão.
            </p>
          </div>
        </div>
      ) : null}

      <div className="px-5 mt-4 grid gap-2">
        <SettingsItem
          to="/app/configuracoes/automacoes"
          icon={Zap}
          title="Automações"
          subtitle="Modelos, janela de envio e pausa global."
          adminOnly
        />
        <SettingsItem
          to="/app/configuracoes/zapi"
          icon={Smartphone}
          title="WhatsApp (Z-API)"
          subtitle="Conexão, instância e webhooks."
          adminOnly
        />
        <SettingsItem
          to="/app/configuracoes/variaveis"
          icon={Variable}
          title="Variáveis"
          subtitle="Catálogo de variáveis usadas nos modelos."
        />
      </div>
    </>
  );
}

function SettingsItem({
  to,
  icon: Icon,
  title,
  subtitle,
  adminOnly,
}: {
  to: string;
  icon: typeof Zap;
  title: string;
  subtitle: string;
  adminOnly?: boolean;
}) {
  return (
    <Link
      to={to}
      className="rounded-2xl bg-card shadow-soft p-4 flex items-center gap-3"
    >
      <span className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center">
        <Icon className="h-5 w-5" strokeWidth={1.5} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-label flex items-center gap-2">
          {title}
          {adminOnly ? (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              Admin
            </span>
          ) : null}
        </div>
        <p className="text-caption text-muted-foreground truncate">{subtitle}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
