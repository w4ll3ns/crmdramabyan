import { useMetricasAutomacoes } from "@/hooks/useReguas";

export function PainelMetricas() {
  const { data, isLoading } = useMetricasAutomacoes();
  if (isLoading || !data) return <div className="text-muted-foreground">Carregando…</div>;

  const pct = (n: number) => `${Math.round(n * 100)}%`;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Card label="Enviadas (30d)" value={String(data.enviadas_30d)} />
        <Card label="Taxa confirmação" value={pct(data.taxa_confirmacao)} />
        <Card label="Taxa no-show" value={pct(data.taxa_no_show)} />
        <Card label="Recalls convertidos" value={String(data.recalls_convertidos)} />
      </div>
      <div className="rounded-2xl bg-card shadow-soft p-4">
        <div className="text-label mb-2">Por tipo (30 dias)</div>
        <div className="flex flex-col gap-2">
          {Object.entries(data.por_tipo).map(([tipo, m]) => (
            <div key={tipo} className="flex items-center justify-between text-caption">
              <span className="capitalize">{tipo.replace(/_/g, " ")}</span>
              <span className="text-muted-foreground">
                {m.enviadas} enviadas · {m.pendentes} pendentes · {m.canceladas} canceladas
              </span>
            </div>
          ))}
          {Object.keys(data.por_tipo).length === 0 ? (
            <p className="text-caption text-muted-foreground">Sem dados ainda.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card shadow-soft p-4">
      <div className="text-caption text-muted-foreground">{label}</div>
      <div className="text-h1 text-foreground mt-1">{value}</div>
    </div>
  );
}
