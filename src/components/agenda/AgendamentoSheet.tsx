import { useEffect, useMemo, useState } from "react";
import { Search, UserPlus, Check, Loader2 } from "lucide-react";
import { BottomSheet } from "@/components/brand/BottomSheet";
import { SegmentedControl } from "@/components/brand/SegmentedControl";
import { BrandAvatar } from "@/components/brand/Avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type AgendamentoFull,
  type Paciente,
  useCreatePacienteRapido,
  usePacientesSearch,
  useProcedimentos,
  useUpsertAgendamento,
} from "@/hooks/useAgenda";
import {
  type AgendamentoTipo,
  combineDateTime,
  fmtDataLonga,
} from "@/lib/agenda";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function AgendamentoSheet({
  open,
  onOpenChange,
  initial,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: AgendamentoFull | null;
  defaultDate?: Date;
}) {
  const isEdit = !!initial?.id;

  const [paciente, setPaciente] = useState<Paciente | null>(
    initial?.paciente ?? null,
  );
  const [tipo, setTipo] = useState<AgendamentoTipo>(initial?.tipo ?? "avaliacao");
  const [procedimentoId, setProcedimentoId] = useState<string | null>(
    initial?.procedimento_id ?? null,
  );
  const [duracao, setDuracao] = useState<number>(initial?.duracao_minutos ?? 60);
  const [valor, setValor] = useState<string>(
    initial?.valor != null ? String(initial.valor) : "",
  );
  const [data, setData] = useState<Date>(
    initial ? new Date(initial.data_hora) : (defaultDate ?? new Date()),
  );
  const [hora, setHora] = useState<string>(() => {
    const d = initial ? new Date(initial.data_hora) : (defaultDate ?? new Date());
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const [profissional, setProfissional] = useState<string>(
    initial?.profissional ?? "Dra. Mabyan",
  );
  const [obs, setObs] = useState<string>(initial?.observacoes ?? "");

  // Reset state quando reabrir limpo
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setPaciente(initial.paciente ?? null);
      setTipo(initial.tipo);
      setProcedimentoId(initial.procedimento_id ?? null);
      setDuracao(initial.duracao_minutos);
      setValor(initial.valor != null ? String(initial.valor) : "");
      const d = new Date(initial.data_hora);
      setData(d);
      setHora(
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      );
      setProfissional(initial.profissional ?? "Dra. Mabyan");
      setObs(initial.observacoes ?? "");
    } else {
      setPaciente(null);
      setTipo("avaliacao");
      setProcedimentoId(null);
      setDuracao(60);
      setValor("");
      const d = defaultDate ?? new Date();
      setData(d);
      const now = new Date();
      setHora(
        defaultDate
          ? "09:00"
          : `${String(now.getHours()).padStart(2, "0")}:00`,
      );
      setProfissional("Dra. Mabyan");
      setObs("");
    }
  }, [open, initial, defaultDate]);

  const upsert = useUpsertAgendamento();

  const canSave = !!paciente && !!data && !!hora && !upsert.isPending;

  async function handleSave() {
    if (!paciente) return;
    try {
      await upsert.mutateAsync({
        id: initial?.id,
        paciente_id: paciente.id,
        procedimento_id: procedimentoId,
        tipo,
        data_hora: combineDateTime(data, hora),
        duracao_minutos: duracao || 60,
        valor: valor ? Number(valor) : null,
        profissional: profissional || null,
        observacoes: obs || null,
      });
      toast.success(isEdit ? "Agendamento atualizado" : "Agendamento criado");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    }
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Editar agendamento" : "Novo agendamento"}
    >
      <div className="flex flex-col gap-5 max-h-[72vh] overflow-y-auto pr-1">
        {/* Paciente */}
        <Section title="Paciente">
          <PacientePicker selected={paciente} onSelect={setPaciente} />
        </Section>

        {/* Tipo */}
        <Section title="Tipo">
          <SegmentedControl<AgendamentoTipo>
            value={tipo}
            onChange={setTipo}
            options={[
              { label: "Avaliação", value: "avaliacao" },
              { label: "Procedimento", value: "procedimento" },
              { label: "Retorno", value: "retorno" },
            ]}
          />
        </Section>

        {/* Procedimento */}
        <Section title="Procedimento">
          <ProcedimentoSelect
            value={procedimentoId}
            onChange={(id, p) => {
              setProcedimentoId(id);
              if (p?.duracao_minutos) setDuracao(p.duracao_minutos);
              if (p?.valor_padrao != null) setValor(String(p.valor_padrao));
            }}
          />
          <div className="grid grid-cols-2 gap-3 mt-3">
            <LabeledInput
              label="Duração (min)"
              type="number"
              inputMode="numeric"
              value={String(duracao)}
              onChange={(v) => setDuracao(Number(v) || 0)}
            />
            <LabeledInput
              label="Valor (R$)"
              type="number"
              inputMode="decimal"
              value={valor}
              onChange={setValor}
            />
          </div>
        </Section>

        {/* Data e hora */}
        <Section title="Data e hora">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="justify-start font-normal h-11"
                >
                  {fmtDataLonga(data)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={data}
                  onSelect={(d) => d && setData(d)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              step={300}
              className="h-11 w-[120px]"
            />
          </div>
        </Section>

        {/* Profissional */}
        <Section title="Profissional">
          <Input
            value={profissional}
            onChange={(e) => setProfissional(e.target.value)}
            placeholder="Profissional responsável"
            className="h-11"
          />
        </Section>

        {/* Observações */}
        <Section title="Observações">
          <Textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Anotações internas"
            rows={3}
          />
        </Section>
      </div>

      <div className="sticky bottom-0 -mx-6 mt-4 px-6 pt-3 pb-2 bg-card border-t border-border">
        <Button
          onClick={handleSave}
          disabled={!canSave}
          className="w-full h-12 text-base"
        >
          {upsert.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isEdit ? (
            "Salvar alterações"
          ) : (
            "Agendar"
          )}
        </Button>
      </div>
    </BottomSheet>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-caption uppercase tracking-wide text-muted-foreground mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-caption text-muted-foreground">{label}</span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11"
        {...rest}
      />
    </label>
  );
}

function PacientePicker({
  selected,
  onSelect,
}: {
  selected: Paciente | null;
  onSelect: (p: Paciente | null) => void;
}) {
  const [term, setTerm] = useState("");
  const [creating, setCreating] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoTel, setNovoTel] = useState("");
  const debounced = useDebounced(term, 200);
  const { data, isFetching } = usePacientesSearch(debounced);
  const create = useCreatePacienteRapido();

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 px-3 py-2.5">
        <BrandAvatar name={selected.nome} size={40} />
        <div className="flex-1 min-w-0">
          <div className="text-label font-medium truncate">{selected.nome}</div>
          <div className="text-caption text-muted-foreground truncate">
            {selected.whatsapp || selected.telefone || "Sem telefone"}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onSelect(null)}>
          Trocar
        </Button>
      </div>
    );
  }

  if (creating) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/30 p-3">
        <Input
          autoFocus
          placeholder="Nome do paciente"
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          className="h-11"
        />
        <Input
          placeholder="Telefone (opcional)"
          value={novoTel}
          inputMode="tel"
          onChange={(e) => setNovoTel(e.target.value)}
          className="h-11"
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              setCreating(false);
              setNovoNome("");
              setNovoTel("");
            }}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={!novoNome.trim() || create.isPending}
            onClick={async () => {
              try {
                const p = await create.mutateAsync({
                  nome: novoNome,
                  telefone: novoTel,
                });
                onSelect(p);
                setCreating(false);
              } catch (e: any) {
                toast.error(e?.message ?? "Erro ao criar paciente");
              }
            }}
          >
            {create.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Criar"
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar paciente"
          className="pl-9 h-11"
        />
      </div>
      <div className="max-h-48 overflow-y-auto rounded-xl border border-border divide-y divide-border">
        {isFetching && (
          <div className="flex items-center justify-center py-3 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
        {!isFetching && (data?.length ?? 0) === 0 && (
          <div className="px-3 py-3 text-caption text-muted-foreground">
            Nenhum paciente encontrado.
          </div>
        )}
        {(data ?? []).map((p) => (
          <button
            type="button"
            key={p.id}
            onClick={() => onSelect(p)}
            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50"
          >
            <BrandAvatar name={p.nome} size={32} />
            <div className="flex-1 min-w-0">
              <div className="text-label truncate">{p.nome}</div>
              <div className="text-caption text-muted-foreground truncate">
                {p.whatsapp || p.telefone || "—"}
              </div>
            </div>
            <Check className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
          </button>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-center gap-2"
        onClick={() => setCreating(true)}
      >
        <UserPlus className="h-4 w-4" />
        Novo paciente rápido
      </Button>
    </div>
  );
}

function ProcedimentoSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (
    id: string | null,
    p: { duracao_minutos: number | null; valor_padrao: number | null } | null,
  ) => void;
}) {
  const { data } = useProcedimentos();
  const items = data ?? [];
  const byId = useMemo(() => {
    const m = new Map<string, (typeof items)[number]>();
    items.forEach((p) => m.set(p.id, p));
    return m;
  }, [items]);

  return (
    <Select
      value={value ?? "none"}
      onValueChange={(v) => {
        if (v === "none") return onChange(null, null);
        const p = byId.get(v);
        onChange(v, p ? { duracao_minutos: p.duracao_minutos, valor_padrao: p.valor_padrao } : null);
      }}
    >
      <SelectTrigger className="h-11">
        <SelectValue placeholder="Selecionar procedimento" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Nenhum</SelectItem>
        {items.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.nome}
            {p.duracao_minutos ? ` · ${p.duracao_minutos} min` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
