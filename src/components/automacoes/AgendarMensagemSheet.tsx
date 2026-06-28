import { useEffect, useMemo, useState } from "react";
import { BottomSheet } from "@/components/brand/BottomSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useModelos, useCreateMensagemAgendada } from "@/hooks/useMensagens";
import { MOCK_VARS, renderTemplate, type ModeloTipo } from "@/lib/templates";
import { toast } from "sonner";

export function AgendarMensagemSheet({
  open,
  onOpenChange,
  pacienteId,
  conversationId,
  defaultVars,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pacienteId: string;
  conversationId?: string | null;
  defaultVars?: Record<string, unknown>;
}) {
  const { data: modelos } = useModelos();
  const create = useCreateMensagemAgendada();

  const [modeloId, setModeloId] = useState<string>("__livre");
  const [texto, setTexto] = useState("");
  const [data, setData] = useState<string>(""); // yyyy-mm-dd
  const [hora, setHora] = useState<string>("09:00");

  useEffect(() => {
    if (open) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      setData(d.toISOString().slice(0, 10));
      setHora("09:00");
      setModeloId("__livre");
      setTexto("");
    }
  }, [open]);

  const modelo = useMemo(
    () => modelos?.find((m) => m.id === modeloId) ?? null,
    [modelos, modeloId],
  );

  const vars = { ...MOCK_VARS, ...(defaultVars ?? {}) };
  const preview = modelo
    ? renderTemplate(modelo.corpo, vars)
    : texto;

  const submit = async () => {
    if (!data || !hora) {
      toast.error("Escolha data e hora");
      return;
    }
    const iso = new Date(`${data}T${hora}:00`).toISOString();
    const tipo: ModeloTipo = (modelo?.tipo ?? "manual") as ModeloTipo;
    try {
      await create.mutateAsync({
        paciente_id: pacienteId,
        conversation_id: conversationId ?? null,
        modelo_id: modelo?.id ?? null,
        tipo,
        conteudo_renderizado: modelo ? "" : texto,
        variaveis: defaultVars ?? {},
        agendado_para: iso,
      });
      toast.success("Mensagem agendada");
      onOpenChange(false);
    } catch (e) {
      toast.error("Falha ao agendar", { description: (e as Error).message });
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Agendar mensagem"
      description="Será enviada via WhatsApp dentro da janela configurada."
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-caption text-muted-foreground">Modelo</label>
          <Select value={modeloId} onValueChange={setModeloId}>
            <SelectTrigger>
              <SelectValue placeholder="Texto livre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__livre">Texto livre</SelectItem>
              {(modelos ?? []).filter((m) => m.ativo).map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!modelo && (
          <div>
            <label className="text-caption text-muted-foreground">Mensagem</label>
            <Textarea
              rows={4}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escreva a mensagem…"
            />
          </div>
        )}

        {modelo && (
          <div>
            <label className="text-caption text-muted-foreground">Prévia</label>
            <div className="mt-1 rounded-2xl bg-secondary/50 p-3 text-body whitespace-pre-wrap min-h-[70px]">
              {preview}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-caption text-muted-foreground">Data</label>
            <Input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>
          <div>
            <label className="text-caption text-muted-foreground">Hora</label>
            <Input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={submit} disabled={create.isPending}>
          {create.isPending ? "Agendando…" : "Agendar"}
        </Button>
      </div>
    </BottomSheet>
  );
}
