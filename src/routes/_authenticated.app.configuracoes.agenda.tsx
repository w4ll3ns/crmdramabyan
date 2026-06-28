import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, CalendarDays, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  type DiaKey,
  type Expediente,
  DIAS_LABEL,
  DIAS_ORDEM,
  useBloqueios,
  useCreateBloqueio,
  useDeleteBloqueio,
  useExpediente,
  useUpdateExpediente,
} from "@/hooks/useAgendaConfig";

export const Route = createFileRoute(
  "/_authenticated/app/configuracoes/agenda",
)({
  component: AgendaConfigPage,
});

function AgendaConfigPage() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const { data: expediente } = useExpediente();
  const updateExp = useUpdateExpediente();
  const { data: bloqueios } = useBloqueios();
  const createBloq = useCreateBloqueio();
  const delBloq = useDeleteBloqueio();

  const [exp, setExp] = useState<Expediente | null>(null);
  useEffect(() => {
    if (expediente && !exp) setExp(expediente);
  }, [expediente, exp]);

  const [novoData, setNovoData] = useState("");
  const [novoMotivo, setNovoMotivo] = useState("");
  const [novoDiaInteiro, setNovoDiaInteiro] = useState(true);
  const [novoInicio, setNovoInicio] = useState("08:00");
  const [novoFim, setNovoFim] = useState("18:00");

  const onSaveExp = async () => {
    if (!exp) return;
    try {
      await updateExp.mutateAsync(exp);
      toast.success("Expediente atualizado");
    } catch (e) {
      toast.error("Erro ao salvar", { description: (e as Error).message });
    }
  };

  const onAddBloqueio = async () => {
    if (!novoData) {
      toast.error("Informe a data");
      return;
    }
    try {
      await createBloq.mutateAsync({
        data: novoData,
        motivo: novoMotivo.trim() || undefined,
        dia_inteiro: novoDiaInteiro,
        inicio: novoDiaInteiro ? null : novoInicio,
        fim: novoDiaInteiro ? null : novoFim,
      });
      setNovoData("");
      setNovoMotivo("");
      setNovoDiaInteiro(true);
      toast.success("Bloqueio adicionado");
    } catch (e) {
      toast.error("Erro ao adicionar", { description: (e as Error).message });
    }
  };

  return (
    <>
      <header className="sticky top-0 z-20 bg-background/85 backdrop-blur border-b border-border">
        <div className="px-5 py-3 flex items-center gap-2">
          <button
            onClick={() => navigate({ to: "/app/configuracoes" })}
            className="h-9 w-9 rounded-full hover:bg-muted flex items-center justify-center"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-caption text-muted-foreground">Configurações</p>
            <h1 className="text-title flex items-center gap-2">
              <CalendarDays className="h-5 w-5" strokeWidth={1.5} />
              Agenda
            </h1>
          </div>
        </div>
      </header>

      <section className="px-5 mt-4">
        <h2 className="text-label mb-2">Expediente</h2>
        <p className="text-caption text-muted-foreground mb-3">
          Defina o horário de abertura e fechamento por dia da semana.
        </p>
        <div className="rounded-2xl bg-card shadow-soft divide-y divide-border">
          {exp &&
            DIAS_ORDEM.map((d) => (
              <DiaRow
                key={d}
                dia={d}
                faixa={exp[d]}
                disabled={isAdmin !== true}
                onChange={(faixa) => setExp({ ...exp, [d]: faixa })}
              />
            ))}
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            onClick={onSaveExp}
            disabled={isAdmin !== true || !exp || updateExp.isPending}
          >
            Salvar expediente
          </Button>
        </div>
      </section>

      <section className="px-5 mt-8">
        <h2 className="text-label mb-2">Bloqueios e feriados</h2>
        <div className="rounded-2xl bg-card shadow-soft p-4 grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-caption text-muted-foreground">Data</label>
              <Input
                type="date"
                value={novoData}
                onChange={(e) => setNovoData(e.target.value)}
              />
            </div>
            <div>
              <label className="text-caption text-muted-foreground">Motivo</label>
              <Input
                value={novoMotivo}
                onChange={(e) => setNovoMotivo(e.target.value)}
                placeholder="Ex.: Feriado"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={novoDiaInteiro}
              onCheckedChange={setNovoDiaInteiro}
              disabled={isAdmin !== true}
            />
            <span className="text-body">Dia inteiro</span>
          </div>
          {!novoDiaInteiro && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-caption text-muted-foreground">Início</label>
                <Input
                  type="time"
                  value={novoInicio}
                  onChange={(e) => setNovoInicio(e.target.value)}
                />
              </div>
              <div>
                <label className="text-caption text-muted-foreground">Fim</label>
                <Input
                  type="time"
                  value={novoFim}
                  onChange={(e) => setNovoFim(e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button
              onClick={onAddBloqueio}
              disabled={isAdmin !== true || createBloq.isPending}
            >
              <Plus className="h-4 w-4 mr-1" strokeWidth={1.5} />
              Adicionar
            </Button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-card shadow-soft divide-y divide-border">
          {(bloqueios ?? []).length === 0 && (
            <div className="p-4 text-caption text-muted-foreground">
              Nenhum bloqueio cadastrado.
            </div>
          )}
          {(bloqueios ?? []).map((b) => (
            <div key={b.id} className="p-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="text-body">
                  {fmtData(b.data)}
                  {b.dia_inteiro
                    ? " · dia inteiro"
                    : ` · ${b.inicio?.slice(0, 5)}–${b.fim?.slice(0, 5)}`}
                </div>
                {b.motivo && (
                  <div className="text-caption text-muted-foreground">
                    {b.motivo}
                  </div>
                )}
              </div>
              <button
                onClick={() => delBloq.mutate(b.id)}
                disabled={isAdmin !== true}
                className="h-9 w-9 rounded-full hover:bg-muted flex items-center justify-center text-destructive disabled:opacity-40"
                aria-label="Remover"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="h-8" />
    </>
  );
}

function DiaRow({
  dia,
  faixa,
  disabled,
  onChange,
}: {
  dia: DiaKey;
  faixa: [string, string] | null;
  disabled: boolean;
  onChange: (f: [string, string] | null) => void;
}) {
  const aberto = faixa !== null;
  return (
    <div className="p-3 flex items-center gap-3">
      <div className="w-24 text-body">{DIAS_LABEL[dia]}</div>
      <Switch
        checked={aberto}
        disabled={disabled}
        onCheckedChange={(v) => onChange(v ? ["08:00", "18:00"] : null)}
      />
      {aberto && faixa && (
        <>
          <Input
            type="time"
            className="w-28"
            value={faixa[0]}
            disabled={disabled}
            onChange={(e) => onChange([e.target.value, faixa[1]])}
          />
          <span className="text-caption text-muted-foreground">–</span>
          <Input
            type="time"
            className="w-28"
            value={faixa[1]}
            disabled={disabled}
            onChange={(e) => onChange([faixa[0], e.target.value])}
          />
        </>
      )}
      {!aberto && (
        <span className="text-caption text-muted-foreground">Fechado</span>
      )}
    </div>
  );
}

function fmtData(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
