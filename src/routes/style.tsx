import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Heart, Calendar, Sparkles } from "lucide-react";
import { Monogram } from "@/components/brand/Monogram";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { ListRow } from "@/components/brand/ListRow";
import { StatCard } from "@/components/brand/StatCard";
import { SectionHeader } from "@/components/brand/SectionHeader";
import { Chip, ChipRow } from "@/components/brand/Chip";
import { SegmentedControl } from "@/components/brand/SegmentedControl";
import { EmptyState } from "@/components/brand/EmptyState";
import { Fab } from "@/components/brand/Fab";
import { BottomSheet } from "@/components/brand/BottomSheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/style")({
  head: () => ({
    meta: [{ title: "Style Guide — Dra. Mabyan" }],
  }),
  component: StyleGuide,
});

const swatches = [
  { name: "background", token: "bg-background", border: true },
  { name: "card", token: "bg-card", border: true },
  { name: "primary", token: "bg-primary" },
  { name: "primary-hover", token: "bg-primary-hover" },
  { name: "accent", token: "bg-accent" },
  { name: "foreground", token: "bg-foreground" },
  { name: "muted", token: "bg-muted", border: true },
  { name: "muted-foreground", token: "bg-muted-foreground" },
  { name: "border", token: "bg-border" },
  { name: "input", token: "bg-input", border: true },
  { name: "success", token: "bg-success" },
  { name: "warning", token: "bg-warning" },
  { name: "danger", token: "bg-danger" },
];

function StyleGuide() {
  const [seg, setSeg] = useState<"dia" | "semana">("dia");
  const [chip, setChip] = useState("todos");
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-background pb-20">
      <header className="surface-tint sticky top-0 z-30 pt-safe border-b border-border/60 backdrop-blur">
        <div className="flex items-center gap-3 px-5 py-3">
          <Monogram size={40} />
          <div className="flex-1">
            <div className="text-h2">Style Guide</div>
            <div className="text-caption text-muted-foreground">
              Dra. Mabyan — design system
            </div>
          </div>
          <Link
            to="/auth"
            className="text-caption text-primary hover:text-primary-hover"
          >
            Login →
          </Link>
        </div>
      </header>

      <SectionHeader title="Cores" />
      <div className="px-5 grid grid-cols-3 gap-3">
        {swatches.map((s) => (
          <div key={s.name} className="flex flex-col gap-2">
            <div
              className={`${s.token} h-16 rounded-2xl ${s.border ? "border border-border" : ""} shadow-soft`}
            />
            <div className="text-caption text-foreground">{s.name}</div>
          </div>
        ))}
      </div>

      <div className="px-5 mt-4 flex flex-wrap gap-2">
        <StatusBadge variant="success">Confirmado</StatusBadge>
        <StatusBadge variant="warning">A confirmar</StatusBadge>
        <StatusBadge variant="danger">Cancelado</StatusBadge>
        <StatusBadge variant="info">Novo lead</StatusBadge>
        <StatusBadge variant="neutral">Arquivado</StatusBadge>
      </div>

      <SectionHeader title="Tipografia" />
      <div className="px-5 flex flex-col gap-3">
        <div>
          <div className="text-display">Display 30 · serif</div>
          <div className="text-caption text-muted-foreground">Playfair Display 700</div>
        </div>
        <div>
          <div className="text-h1">H1 — Saudação serif</div>
          <div className="text-caption text-muted-foreground">24 / Playfair 700</div>
        </div>
        <div>
          <div className="text-h2">H2 — Título de seção</div>
          <div className="text-caption text-muted-foreground">20 / Playfair 600</div>
        </div>
        <div>
          <div className="text-body">
            Body 16 · Inter — Olá, este é o texto de corpo do app.
          </div>
        </div>
        <div>
          <div className="text-label">Label 14 — campos de formulário</div>
        </div>
        <div>
          <div className="text-caption text-muted-foreground">
            Caption 12 — auxiliares
          </div>
        </div>
      </div>

      <SectionHeader title="Botões" />
      <div className="px-5 flex flex-wrap gap-3 items-center">
        <button className="h-11 px-5 rounded-xl bg-primary text-primary-foreground text-label font-semibold shadow-soft hover:bg-primary-hover active:scale-95 transition-all">
          Primário
        </button>
        <button className="h-11 px-5 rounded-xl bg-card border border-border text-foreground text-label hover:border-primary/40 active:scale-95 transition-all">
          Secundário
        </button>
        <button className="h-11 px-5 rounded-xl text-primary text-label hover:bg-primary/10 active:scale-95 transition-all">
          Ghost
        </button>
        <button className="h-11 px-5 rounded-xl bg-danger/15 text-danger text-label hover:bg-danger/25 active:scale-95 transition-all">
          Perigo
        </button>
        <Fab aria-label="FAB demo">
          <Plus className="h-6 w-6" strokeWidth={1.75} />
        </Fab>
      </div>

      <SectionHeader title="Inputs" />
      <div className="px-5 flex flex-col gap-3 max-w-md">
        <div className="flex flex-col gap-1.5">
          <Label className="text-label">Nome</Label>
          <Input className="h-12 rounded-xl bg-input border-border" placeholder="Ana Beatriz" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-label">Telefone</Label>
          <Input className="h-12 rounded-xl bg-input border-border" placeholder="(11) 99999-9999" />
        </div>
      </div>

      <SectionHeader title="Chips & Segmented" />
      <ChipRow>
        {["todos", "hoje", "semana", "confirmados", "novos"].map((c) => (
          <Chip key={c} active={chip === c} onClick={() => setChip(c)}>
            {c}
          </Chip>
        ))}
      </ChipRow>
      <div className="px-5 mt-3">
        <SegmentedControl
          value={seg}
          onChange={setSeg}
          options={[
            { label: "Dia", value: "dia" },
            { label: "Semana", value: "semana" },
          ]}
        />
      </div>

      <SectionHeader title="Cards" />
      <div className="px-5 grid grid-cols-2 gap-3">
        <StatCard label="Hoje" value={6} hint="atendimentos" icon={Calendar} />
        <StatCard label="Receita" value="R$ 4,2k" hint="esta semana" icon={Sparkles} />
      </div>

      <SectionHeader title="List rows" />
      <div className="px-3 flex flex-col gap-2">
        <ListRow
          name="Ana Beatriz"
          title="Ana Beatriz Lima"
          subtitle="Última consulta há 2 semanas"
          right={<StatusBadge variant="success">Ativa</StatusBadge>}
        />
        <ListRow
          name="Marina Reis"
          title="Marina Reis"
          subtitle="Primeira avaliação"
          right={<StatusBadge variant="info">Nova</StatusBadge>}
        />
      </div>

      <SectionHeader title="Feedback" />
      <div className="px-5 flex flex-col gap-3">
        <div className="rounded-3xl bg-card p-4 flex flex-col gap-3 shadow-soft">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <EmptyState
          icon={<Heart className="h-7 w-7" strokeWidth={1.5} />}
          title="Sem favoritos ainda"
          description="Marque pacientes como favoritos para vê-los aqui."
        />
        <button
          onClick={() => toast.success("Tudo pronto, doutora.")}
          className="h-11 px-5 rounded-xl bg-primary text-primary-foreground text-label font-semibold shadow-soft hover:bg-primary-hover transition-all"
        >
          Disparar toast
        </button>
      </div>

      <SectionHeader title="Bottom sheet" />
      <div className="px-5">
        <BottomSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title="Novo agendamento"
          description="Preencha rapidamente para confirmar."
          trigger={
            <button className="h-11 px-5 rounded-xl bg-primary text-primary-foreground text-label font-semibold shadow-soft hover:bg-primary-hover transition-all">
              Abrir sheet
            </button>
          }
        >
          <div className="flex flex-col gap-3">
            <Input className="h-12 rounded-xl bg-input border-border" placeholder="Paciente" />
            <Input className="h-12 rounded-xl bg-input border-border" placeholder="Procedimento" />
            <button
              onClick={() => {
                setSheetOpen(false);
                toast.success("Agendamento criado.");
              }}
              className="h-12 rounded-xl bg-primary text-primary-foreground text-label font-semibold mt-2"
            >
              Confirmar
            </button>
          </div>
        </BottomSheet>
      </div>
    </div>
  );
}
