import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import {
  type AutomacaoSettings,
  useAutomacaoSettings,
  useUpdateAutomacaoSettings,
} from "@/hooks/useMensagens";
import { toast } from "sonner";

export function JanelaConfigForm() {
  const { data } = useAutomacaoSettings();
  const update = useUpdateAutomacaoSettings();
  const [s, setS] = useState<AutomacaoSettings | null>(null);

  useEffect(() => {
    if (data && !s) setS(data);
  }, [data, s]);

  if (!s) return <div className="text-caption text-muted-foreground">Carregando…</div>;

  const save = async () => {
    await update.mutateAsync(s);
    toast.success("Automações atualizadas");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-2xl border border-border p-4">
        <div>
          <div className="text-label">Pausar automações</div>
          <p className="text-caption text-muted-foreground">
            Interrompe todo o envio agendado.
          </p>
        </div>
        <Switch
          checked={!!s.automacoes_pausado}
          onCheckedChange={(v) => setS({ ...s, automacoes_pausado: v })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-caption text-muted-foreground">Início janela</label>
          <Input
            type="time"
            value={s.automacoes_janela_inicio}
            onChange={(e) =>
              setS({ ...s, automacoes_janela_inicio: e.target.value })
            }
          />
        </div>
        <div>
          <label className="text-caption text-muted-foreground">Fim janela</label>
          <Input
            type="time"
            value={s.automacoes_janela_fim}
            onChange={(e) =>
              setS({ ...s, automacoes_janela_fim: e.target.value })
            }
          />
        </div>
      </div>

      <div>
        <label className="text-caption text-muted-foreground">Fuso horário</label>
        <Input
          value={s.automacoes_fuso}
          onChange={(e) => setS({ ...s, automacoes_fuso: e.target.value })}
          placeholder="America/Fortaleza"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-caption text-muted-foreground">
            Limite por minuto
          </label>
          <Input
            type="number"
            min={1}
            max={60}
            value={s.automacoes_limite_minuto}
            onChange={(e) =>
              setS({
                ...s,
                automacoes_limite_minuto: parseInt(e.target.value || "1", 10),
              })
            }
          />
        </div>
        <div>
          <label className="text-caption text-muted-foreground">
            Palavra opt-out
          </label>
          <Input
            value={s.automacoes_palavra_optout}
            onChange={(e) =>
              setS({ ...s, automacoes_palavra_optout: e.target.value })
            }
          />
        </div>
      </div>

      <Button onClick={save} disabled={update.isPending}>
        {update.isPending ? "Salvando…" : "Salvar configurações"}
      </Button>
    </div>
  );
}
