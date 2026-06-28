import { useReguas, useSetRegua, type ReguaKey } from "@/hooks/useReguas";
import { toast } from "sonner";

type Field =
  | { kind: "time"; key: string; label: string }
  | { kind: "number"; key: string; label: string; min?: number; max?: number; suffix?: string }
  | { kind: "days_csv"; key: string; label: string };

type ReguaDef = {
  chave: ReguaKey;
  titulo: string;
  descricao: string;
  fields: Field[];
};

const REGUAS: ReguaDef[] = [
  {
    chave: "regua_confirmacao",
    titulo: "Confirmação 2-vias",
    descricao: "Envia D-1 18:00 e reforço D-0 manhã. Paciente responde 1/2.",
    fields: [
      { kind: "time", key: "hora_d1", label: "Hora D-1" },
      { kind: "time", key: "hora_d0", label: "Hora D-0" },
      { kind: "number", key: "antecedencia_horas_minimo", label: "Antecedência mínima", suffix: "h" },
    ],
  },
  {
    chave: "regua_lembrete",
    titulo: "Lembrete",
    descricao: "Antes do horário do agendamento confirmado.",
    fields: [{ kind: "number", key: "horas_antes", label: "Horas antes", suffix: "h" }],
  },
  {
    chave: "regua_pos_procedimento",
    titulo: "Pós-procedimento",
    descricao: "Mensagens após o atendimento realizado.",
    fields: [{ kind: "days_csv", key: "dias", label: "Dias após (ex: 1,7)" }],
  },
  {
    chave: "regua_retorno",
    titulo: "Retorno",
    descricao: "Usa retorno_dias do procedimento.",
    fields: [],
  },
  {
    chave: "regua_recall",
    titulo: "Recall",
    descricao: "Usa recorrencia_dias do procedimento.",
    fields: [],
  },
  {
    chave: "regua_aniversario",
    titulo: "Aniversário",
    descricao: "Mensagem diária 08:00 (cron).",
    fields: [{ kind: "time", key: "hora", label: "Hora" }],
  },
  {
    chave: "regua_no_show",
    titulo: "No-show",
    descricao: "Após status \"faltou\". Cria também tarefa de remarcar.",
    fields: [{ kind: "number", key: "horas_apos", label: "Horas após", suffix: "h" }],
  },
  {
    chave: "regua_reativacao",
    titulo: "Reativação",
    descricao: "Semanal, pacientes sem agendamento realizado há N meses.",
    fields: [
      { kind: "number", key: "meses_inatividade", label: "Meses inatividade", suffix: "m" },
      { kind: "number", key: "janela_dias", label: "Janela (sem repetir)", suffix: "d" },
    ],
  },
];

type Cfg = { enabled?: boolean; [k: string]: unknown };

export function ReguasTab() {
  const { data: reguas, isLoading } = useReguas();
  const set = useSetRegua();
  const pausado = (reguas?.automacoes_pausado as boolean | undefined) ?? false;

  if (isLoading) return <div className="text-muted-foreground">Carregando…</div>;

  const update = async (chave: ReguaKey, patch: Partial<Cfg>) => {
    const atual = (reguas?.[chave] as Cfg | undefined) ?? {};
    await set.mutateAsync({ chave, valor: { ...atual, ...patch } });
    toast.success("Régua atualizada");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl bg-card shadow-soft p-4 flex items-center justify-between">
        <div>
          <div className="text-label">Pausa global</div>
          <p className="text-caption text-muted-foreground">
            Para todas as réguas. Mensagens manuais continuam.
          </p>
        </div>
        <label className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={!!pausado}
            onChange={async (e) => {
              await set.mutateAsync({ chave: "automacoes_pausado", valor: e.target.checked });
              toast.success(e.target.checked ? "Automações pausadas" : "Automações ativas");
            }}
          />
          <span className="w-11 h-6 bg-muted rounded-full peer-checked:bg-warning relative after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
        </label>
      </div>

      {REGUAS.map((r) => {
        const cfg = (reguas?.[r.chave] as Cfg | undefined) ?? {};
        const enabled = cfg.enabled ?? true;
        return (
          <div key={r.chave} className="rounded-2xl bg-card shadow-soft p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-label">{r.titulo}</div>
                <p className="text-caption text-muted-foreground">{r.descricao}</p>
              </div>
              <label className="inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={enabled}
                  onChange={(e) => update(r.chave, { enabled: e.target.checked })}
                />
                <span className="w-11 h-6 bg-muted rounded-full peer-checked:bg-primary relative after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
              </label>
            </div>

            {r.fields.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 mt-3">
                {r.fields.map((f) => (
                  <FieldInput
                    key={f.key}
                    field={f}
                    value={cfg[f.key]}
                    onCommit={(v) => update(r.chave, { [f.key]: v })}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onCommit,
}: {
  field: Field;
  value: unknown;
  onCommit: (v: unknown) => void;
}) {
  if (field.kind === "time") {
    return (
      <label className="text-caption text-muted-foreground flex flex-col gap-1">
        {field.label}
        <input
          type="time"
          defaultValue={(value as string) ?? "08:00"}
          onBlur={(e) => onCommit(e.target.value)}
          className="rounded-lg border border-input bg-background px-2 py-1.5 text-foreground text-body"
        />
      </label>
    );
  }
  if (field.kind === "number") {
    return (
      <label className="text-caption text-muted-foreground flex flex-col gap-1">
        {field.label}
        <div className="flex items-center gap-1">
          <input
            type="number"
            defaultValue={Number(value ?? 0)}
            min={field.min}
            max={field.max}
            onBlur={(e) => onCommit(Number(e.target.value))}
            className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-foreground text-body"
          />
          {field.suffix ? <span className="text-caption">{field.suffix}</span> : null}
        </div>
      </label>
    );
  }
  // days_csv
  const arr = Array.isArray(value) ? (value as number[]) : [];
  return (
    <label className="text-caption text-muted-foreground flex flex-col gap-1 col-span-2">
      {field.label}
      <input
        type="text"
        defaultValue={arr.join(",")}
        onBlur={(e) => {
          const parsed = e.target.value
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => !Number.isNaN(n) && n > 0);
          onCommit(parsed);
        }}
        className="rounded-lg border border-input bg-background px-2 py-1.5 text-foreground text-body"
      />
    </label>
  );
}
