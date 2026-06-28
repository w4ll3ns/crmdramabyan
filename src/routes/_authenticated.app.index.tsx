import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Calendar,
  MessageCircle,
  Plus,
  Settings,
  ChevronRight,
  Users,
  Clock,
  TrendingUp,
  CalendarPlus,
  MessageSquarePlus,
  UserPlus,
  Sparkles,
} from "lucide-react";
import { Fab } from "@/components/brand/Fab";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { BottomSheet } from "@/components/brand/BottomSheet";
import { BrandAvatar } from "@/components/brand/Avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import {
  useAConfirmarHojeCount,
  useAgendamentosRange,
  type AgendamentoFull,
} from "@/hooks/useAgenda";
import {
  useFollowupsAtrasadosCount,
  useGreetingName,
  useHomeRealtime,
  useLeadsNovosCount,
  useMiniFunil,
  useNoShowMes,
  useRecallConversionRate,
  useTicketMedioPorProcedimento,
  useToday,
  type FunilEtapa,
} from "@/hooks/useHomeDashboard";
import { formatTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/")({
  component: HomePage,
});

function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

function HomePage() {
  useHomeRealtime();
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const [quickOpen, setQuickOpen] = useState(false);

  const name = useGreetingName();
  const today = useToday();

  return (
    <>
      {/* Saudação */}
      <section className="px-5 pt-8 pb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption text-muted-foreground">{greeting()},</p>
          <h1
            className="mt-1 text-foreground leading-[1.05] tracking-tight"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(2.25rem, 8vw, 3rem)",
              fontWeight: 600,
            }}
          >
            {name.data ?? "…"}
          </h1>
          <p className="text-caption text-muted-foreground mt-2 capitalize">
            {today.label}
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

      {/* Atalhos rápidos (chips) */}
      <div className="flex gap-2 overflow-x-auto px-5 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <QuickChip
          icon={<MessageSquarePlus className="h-4 w-4" strokeWidth={1.75} />}
          label="Nova conversa"
          onClick={() => navigate({ to: "/app/conversas" })}
        />
        <QuickChip
          icon={<CalendarPlus className="h-4 w-4" strokeWidth={1.75} />}
          label="Agendar"
          onClick={() => navigate({ to: "/app/agenda" })}
        />
        <QuickChip
          icon={<UserPlus className="h-4 w-4" strokeWidth={1.75} />}
          label="Novo lead"
          onClick={() => navigate({ to: "/app/funil" })}
        />
      </div>

      {/* Agenda de hoje */}
      <section className="px-5 pt-2">
        <AgendaHojeCard from={today.from} to={today.to} />
      </section>

      {/* Grid de stats */}
      <section className="px-5 pt-4 grid grid-cols-2 gap-3">
        <StatTile
          to="/app/conversas"
          icon={MessageCircle}
          label="Conversas"
          hint="não lidas"
          value={useUnreadCount()}
        />
        <StatTile
          to="/app/funil"
          icon={Sparkles}
          label="Leads novos"
          hint="últimos 7d"
          value={useLeadsNovosCount().data ?? 0}
        />
        <StatTile
          to="/app/funil"
          icon={Clock}
          label="Follow-ups"
          hint="atrasados"
          value={useFollowupsAtrasadosCount().data ?? 0}
          tone={(useFollowupsAtrasadosCount().data ?? 0) > 0 ? "warning" : "default"}
        />
        <StatTile
          to="/app/pacientes"
          icon={Users}
          label="Pacientes"
          hint="ativos hoje"
          value={useAConfirmarHojeCount()}
        />
      </section>

      {/* Mini funil */}
      <section className="px-5 pt-5">
        <MiniFunilCard />
      </section>

      {/* Retenção (admin) */}
      {isAdmin ? (
        <section className="px-5 pt-5 pb-2">
          <RetencaoCard />
        </section>
      ) : null}

      {/* FAB */}
      <Fab aria-label="Ações rápidas" onClick={() => setQuickOpen(true)}>
        <Plus className="h-6 w-6" strokeWidth={1.75} />
      </Fab>

      <BottomSheet
        open={quickOpen}
        onOpenChange={setQuickOpen}
        title="Ações rápidas"
      >
        <div className="flex flex-col gap-2 pb-2">
          <QuickAction
            icon={<MessageSquarePlus className="h-5 w-5" strokeWidth={1.5} />}
            title="Nova conversa"
            subtitle="Abrir lista de conversas"
            onClick={() => {
              setQuickOpen(false);
              navigate({ to: "/app/conversas" });
            }}
          />
          <QuickAction
            icon={<CalendarPlus className="h-5 w-5" strokeWidth={1.5} />}
            title="Agendar"
            subtitle="Criar novo agendamento"
            onClick={() => {
              setQuickOpen(false);
              navigate({ to: "/app/agenda" });
            }}
          />
          <QuickAction
            icon={<UserPlus className="h-5 w-5" strokeWidth={1.5} />}
            title="Novo lead"
            subtitle="Adicionar ao funil"
            onClick={() => {
              setQuickOpen(false);
              navigate({ to: "/app/funil" });
            }}
          />
        </div>
      </BottomSheet>
    </>
  );
}

/* ------- Components ------- */

function QuickChip({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card text-foreground border border-border hover:border-primary/40 shadow-soft text-label transition-all"
    >
      <span className="text-primary">{icon}</span>
      {label}
    </button>
  );
}

function StatTile({
  to,
  icon: Icon,
  label,
  hint,
  value,
  tone = "default",
}: {
  to: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  hint: string;
  value: number;
  tone?: "default" | "warning";
}) {
  return (
    <Link
      to={to}
      className={cn(
        "rounded-3xl bg-card shadow-soft p-5 flex flex-col gap-2 active:scale-[0.98] transition-transform",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-caption text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <span
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center",
            tone === "warning"
              ? "bg-warning/15 text-warning"
              : "bg-primary/12 text-primary",
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={1.5} />
        </span>
      </div>
      <div className="text-display text-foreground">{value}</div>
      <div className="text-caption text-muted-foreground">{hint}</div>
    </Link>
  );
}

function AgendaHojeCard({ from, to }: { from: Date; to: Date }) {
  const { data, isLoading } = useAgendamentosRange(from, to);
  const aConfirmar = useAConfirmarHojeCount();

  const proximos = (data ?? [])
    .filter(
      (a) =>
        a.status !== "cancelado" &&
        a.status !== "realizado" &&
        new Date(a.data_hora) >= new Date(),
    )
    .slice(0, 3);

  const total = (data ?? []).filter((a) => a.status !== "cancelado").length;

  return (
    <Link
      to="/app/agenda"
      className="block rounded-3xl bg-card shadow-soft p-5 active:scale-[0.99] transition-transform"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-caption text-muted-foreground uppercase tracking-wide">
            Agenda de hoje
          </div>
          <div className="mt-1 text-h1 text-foreground">
            {isLoading ? <Skeleton className="h-7 w-24" /> : `${total} atendimentos`}
          </div>
          <div className="text-caption text-muted-foreground mt-1">
            {aConfirmar > 0
              ? `${aConfirmar} ${aConfirmar === 1 ? "a confirmar" : "a confirmar"}`
              : "Todos confirmados"}
          </div>
        </div>
        <span className="h-10 w-10 rounded-full bg-primary/12 text-primary flex items-center justify-center shrink-0">
          <Calendar className="h-5 w-5" strokeWidth={1.5} />
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {isLoading ? (
          <>
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </>
        ) : proximos.length === 0 ? (
          <p className="text-caption text-muted-foreground py-2">
            Nenhum atendimento pendente para hoje ✨
          </p>
        ) : (
          proximos.map((a) => <ProximoRow key={a.id} a={a} />)
        )}
      </div>

      <div className="mt-4 flex items-center justify-end text-label text-primary">
        Ver agenda <ChevronRight className="h-4 w-4 ml-1" />
      </div>
    </Link>
  );
}

function ProximoRow({ a }: { a: AgendamentoFull }) {
  const statusVariant: Record<string, "success" | "warning" | "info" | "danger"> = {
    confirmado: "success",
    agendado: "warning",
    em_atendimento: "info",
    faltou: "danger",
  };
  const v = statusVariant[a.status] ?? "info";
  const statusLabel: Record<string, string> = {
    confirmado: "Confirmado",
    agendado: "A confirmar",
    em_atendimento: "Em atend.",
    faltou: "Faltou",
  };
  return (
    <div className="flex items-center gap-3 py-1">
      <BrandAvatar name={a.paciente?.nome ?? "Paciente"} size={36} />
      <div className="flex-1 min-w-0">
        <div className="text-label text-foreground truncate">
          {a.paciente?.nome ?? "Paciente"}
        </div>
        <div className="text-caption text-muted-foreground truncate">
          {formatTime(a.data_hora)} · {a.procedimento?.nome ?? a.tipo}
        </div>
      </div>
      <StatusBadge variant={v}>{statusLabel[a.status] ?? a.status}</StatusBadge>
    </div>
  );
}

function MiniFunilCard() {
  const { data, isLoading } = useMiniFunil();
  const max = Math.max(1, ...(data ?? []).map((e) => e.count));
  const totalValor = (data ?? []).reduce((s, e) => s + e.valor, 0);

  return (
    <Link
      to="/app/funil"
      className="block rounded-3xl bg-card shadow-soft p-5 active:scale-[0.99] transition-transform"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-caption text-muted-foreground uppercase tracking-wide">
            Funil ativo
          </div>
          <div className="mt-1 text-h1 text-foreground">
            {isLoading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              formatBRL(totalValor)
            )}
          </div>
          <div className="text-caption text-muted-foreground mt-1">
            em oportunidades
          </div>
        </div>
        <span className="h-10 w-10 rounded-full bg-accent/25 text-accent-foreground flex items-center justify-center shrink-0">
          <TrendingUp className="h-5 w-5" strokeWidth={1.5} />
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {isLoading ? (
          <Skeleton className="h-20 w-full rounded-2xl" />
        ) : (data ?? []).length === 0 ? (
          <p className="text-caption text-muted-foreground py-2">
            Nenhuma oportunidade aberta.
          </p>
        ) : (
          (data ?? []).map((e) => <FunilBar key={e.etapa} e={e} max={max} />)
        )}
      </div>
    </Link>
  );
}

function FunilBar({ e, max }: { e: FunilEtapa; max: number }) {
  const pct = Math.round((e.count / max) * 100);
  return (
    <div>
      <div className="flex items-center justify-between text-caption text-foreground">
        <span className="truncate">{e.label}</span>
        <span className="text-muted-foreground tabular-nums">
          {e.count} · {formatBRL(e.valor)}
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function RetencaoCard() {
  const ticket = useTicketMedioPorProcedimento(true);
  const recall = useRecallConversionRate(true);
  const noShow = useNoShowMes(true);

  return (
    <div className="rounded-3xl bg-card shadow-soft p-5">
      <div className="flex items-center justify-between">
        <div className="text-caption text-muted-foreground uppercase tracking-wide">
          Retenção · admin
        </div>
        <span className="h-8 w-8 rounded-full bg-primary/12 text-primary flex items-center justify-center">
          <TrendingUp className="h-4 w-4" strokeWidth={1.5} />
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MiniKpi
          label="Recall convertido"
          value={
            recall.isLoading
              ? "—"
              : `${Math.round((recall.data?.rate ?? 0) * 100)}%`
          }
          hint={
            recall.data?.denom
              ? `${recall.data.num}/${recall.data.denom} (30d)`
              : "sem envios 30d"
          }
        />
        <MiniKpi
          label="No-show do mês"
          value={
            noShow.isLoading
              ? "—"
              : `${Math.round((noShow.data?.rate ?? 0) * 100)}%`
          }
          hint={
            noShow.data?.total
              ? `${noShow.data.faltou}/${noShow.data.total}`
              : "sem dados"
          }
        />
      </div>

      <div className="mt-4">
        <div className="text-caption text-muted-foreground mb-2">
          Ticket médio · 90d
        </div>
        {ticket.isLoading ? (
          <Skeleton className="h-16 w-full rounded-2xl" />
        ) : (ticket.data ?? []).length === 0 ? (
          <p className="text-caption text-muted-foreground">
            Sem procedimentos realizados na janela.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {(ticket.data ?? []).map((p) => (
              <div
                key={p.nome}
                className="flex items-center justify-between text-label"
              >
                <span className="truncate text-foreground">{p.nome}</span>
                <span className="text-muted-foreground tabular-nums">
                  {formatBRL(p.ticket)} · {p.volume}x
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniKpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl bg-muted/40 p-3">
      <div className="text-caption text-muted-foreground">{label}</div>
      <div className="text-h2 text-foreground mt-1 tabular-nums">{value}</div>
      {hint ? (
        <div className="text-caption text-muted-foreground mt-0.5">{hint}</div>
      ) : null}
    </div>
  );
}

function QuickAction({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-2xl bg-card hover:bg-muted/50 border border-border p-4 text-left transition-colors"
    >
      <span className="h-10 w-10 rounded-full bg-primary/12 text-primary flex items-center justify-center shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-label text-foreground">{title}</div>
        <div className="text-caption text-muted-foreground">{subtitle}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
