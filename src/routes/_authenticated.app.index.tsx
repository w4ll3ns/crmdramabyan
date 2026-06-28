import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { StatCard } from "@/components/brand/StatCard";
import { SectionHeader } from "@/components/brand/SectionHeader";
import { ListRow } from "@/components/brand/ListRow";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { Fab } from "@/components/brand/Fab";
import { Calendar, MessageCircle, Sparkles, Plus, Settings, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/")({
  component: HomePage,
});

function HomePage() {
  const [name, setName] = useState("Dra.");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email ?? "";
      const first = email.split("@")[0]?.split(".")[0] ?? "Dra.";
      setName(first.charAt(0).toUpperCase() + first.slice(1));
    });
  }, []);

  return (
    <>
      <section className="px-5 pt-6 pb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-caption text-muted-foreground">Bom dia,</p>
          <h1 className="text-display text-foreground mt-1">{name}</h1>
          <p className="text-caption text-muted-foreground mt-2 max-w-xs">
            Tudo pronto para o seu dia. Aqui está um resumo.
          </p>
        </div>
        <Link
          to="/app/configuracoes"
          aria-label="Configurações"
          className="h-10 w-10 rounded-full bg-card shadow-soft flex items-center justify-center text-foreground shrink-0"
        >
          <Settings className="h-5 w-5" strokeWidth={1.5} />
        </Link>
      </section>

      <section className="px-5 pt-3 grid grid-cols-2 gap-3">
        <StatCard label="Hoje" value={6} hint="agendamentos" icon={Calendar} />
        <StatCard label="Conversas" value={3} hint="aguardando" icon={MessageCircle} />
      </section>

      <SectionHeader title="Próximos atendimentos" />
      <div className="px-3 flex flex-col gap-2">
        <ListRow
          name="Ana Beatriz"
          title="Ana Beatriz Lima"
          subtitle="Botox — 09:30"
          right={<StatusBadge variant="success">Confirmado</StatusBadge>}
        />
        <ListRow
          name="Carolina Souza"
          title="Carolina Souza"
          subtitle="Preenchimento labial — 11:00"
          right={<StatusBadge variant="warning">A confirmar</StatusBadge>}
        />
        <ListRow
          name="Marina Reis"
          title="Marina Reis"
          subtitle="Avaliação — 14:30"
          right={<StatusBadge variant="info">Nova</StatusBadge>}
        />
      </div>

      <SectionHeader title="Sugestões" />
      <div className="px-5">
        <div className="rounded-3xl bg-card shadow-soft p-5 flex gap-3 items-start">
          <span className="h-10 w-10 rounded-full bg-accent/25 text-accent-foreground flex items-center justify-center">
            <Sparkles className="h-5 w-5" strokeWidth={1.5} />
          </span>
          <div className="flex-1">
            <div className="text-label text-foreground">Enviar lembretes do dia</div>
            <p className="text-caption text-muted-foreground mt-1">
              3 pacientes ainda não confirmaram presença.
            </p>
          </div>
        </div>
      </div>

      <SectionHeader title="Configurações" />
      <div className="px-5">
        <Link
          to="/app/configuracoes"
          className="rounded-2xl bg-card shadow-soft p-4 flex items-center gap-3"
        >
          <span className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center">
            <Settings className="h-5 w-5" strokeWidth={1.5} />
          </span>
          <div className="flex-1">
            <div className="text-label">Abrir configurações</div>
            <p className="text-caption text-muted-foreground">
              Automações, WhatsApp e mais.
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>

      <Fab aria-label="Novo">
        <Plus className="h-6 w-6" strokeWidth={1.75} />
      </Fab>
    </>
  );
}
