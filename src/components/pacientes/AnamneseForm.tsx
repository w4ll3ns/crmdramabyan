import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  type Anamnese,
  type AnamneseInput,
  useAnamnese,
  useUpsertAnamnese,
} from "@/hooks/usePacienteFicha";
import { toast } from "sonner";

const TEXT_FIELDS: { key: keyof AnamneseInput; label: string; placeholder?: string }[] = [
  { key: "queixa_principal", label: "Queixa principal" },
  { key: "expectativas", label: "Expectativas" },
  { key: "procedimentos_anteriores", label: "Procedimentos anteriores" },
  { key: "alergias", label: "Alergias" },
  { key: "uso_medicamentos", label: "Uso de medicamentos" },
  { key: "doencas_cronicas", label: "Doenças crônicas" },
  { key: "contraindicacoes", label: "Contraindicações" },
  { key: "observacoes_clinicas", label: "Observações clínicas" },
];

const BOOL_FIELDS: { key: keyof AnamneseInput; label: string }[] = [
  { key: "usa_anticoagulante", label: "Usa anticoagulante" },
  { key: "gestante_lactante", label: "Gestante ou lactante" },
  { key: "historico_herpes", label: "Histórico de herpes" },
  { key: "historico_queloide", label: "Histórico de queloide" },
  { key: "fumante", label: "Fumante" },
];

function emptyForm(pacienteId: string): AnamneseInput {
  return {
    paciente_id: pacienteId,
    queixa_principal: "",
    expectativas: "",
    procedimentos_anteriores: "",
    alergias: "",
    uso_medicamentos: "",
    usa_anticoagulante: false,
    gestante_lactante: false,
    historico_herpes: false,
    historico_queloide: false,
    doencas_cronicas: "",
    fumante: false,
    contraindicacoes: "",
    observacoes_clinicas: "",
  };
}

function fromExisting(a: Anamnese): AnamneseInput {
  return {
    paciente_id: a.paciente_id,
    queixa_principal: a.queixa_principal ?? "",
    expectativas: a.expectativas ?? "",
    procedimentos_anteriores: a.procedimentos_anteriores ?? "",
    alergias: a.alergias ?? "",
    uso_medicamentos: a.uso_medicamentos ?? "",
    usa_anticoagulante: a.usa_anticoagulante,
    gestante_lactante: a.gestante_lactante,
    historico_herpes: a.historico_herpes,
    historico_queloide: a.historico_queloide,
    doencas_cronicas: a.doencas_cronicas ?? "",
    fumante: a.fumante,
    contraindicacoes: a.contraindicacoes ?? "",
    observacoes_clinicas: a.observacoes_clinicas ?? "",
  };
}

export function AnamneseForm({ pacienteId }: { pacienteId: string }) {
  const { data, isLoading } = useAnamnese(pacienteId);
  const upsert = useUpsertAnamnese();
  const [form, setForm] = useState<AnamneseInput>(() => emptyForm(pacienteId));

  useEffect(() => {
    if (data) setForm(fromExisting(data));
    else setForm(emptyForm(pacienteId));
  }, [data, pacienteId]);

  function set<K extends keyof AnamneseInput>(k: K, v: AnamneseInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSave() {
    try {
      await upsert.mutateAsync(form);
      toast.success("Anamnese salva");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar anamnese");
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-28">
      {TEXT_FIELDS.map(({ key, label }) => (
        <label key={key} className="flex flex-col gap-1.5">
          <span className="text-caption text-muted-foreground">{label}</span>
          <Textarea
            value={(form[key] as string) ?? ""}
            onChange={(e) => set(key, e.target.value as AnamneseInput[typeof key])}
            rows={3}
          />
        </label>
      ))}

      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        {BOOL_FIELDS.map(({ key, label }) => (
          <label
            key={key}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <span className="text-label">{label}</span>
            <Switch
              checked={!!form[key]}
              onCheckedChange={(v) => set(key, v as AnamneseInput[typeof key])}
            />
          </label>
        ))}
      </div>

      {data?.updated_at ? (
        <div className="text-caption text-muted-foreground">
          Atualizada em {new Date(data.updated_at).toLocaleString("pt-BR")}
        </div>
      ) : null}

      <div className="fixed left-0 right-0 bottom-[88px] px-5 z-30">
        <Button
          onClick={handleSave}
          disabled={upsert.isPending}
          className="w-full h-12 shadow-soft"
        >
          {upsert.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : data ? (
            "Salvar alterações"
          ) : (
            "Salvar anamnese"
          )}
        </Button>
      </div>
    </div>
  );
}
