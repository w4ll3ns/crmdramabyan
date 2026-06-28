import { useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/brand/Chip";
import {
  VARIAVEIS_MENSAGEM,
  MOCK_VARS,
  renderTemplate,
} from "@/lib/templates";
import type { Modelo } from "@/hooks/useMensagens";

const LIMITE = 1000;

export function ModeloEditor({
  modelo,
  onChange,
  onSave,
  saving,
}: {
  modelo: Modelo;
  onChange: (m: Modelo) => void;
  onSave: () => void;
  saving?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const insertVar = (k: string) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? modelo.corpo.length;
    const end = el.selectionEnd ?? start;
    const next =
      modelo.corpo.slice(0, start) + `{{${k}}}` + modelo.corpo.slice(end);
    onChange({ ...modelo, corpo: next });
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + k.length + 4;
      el.setSelectionRange(pos, pos);
    });
  };

  const preview = renderTemplate(modelo.corpo, MOCK_VARS);
  const len = modelo.corpo.length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-caption text-muted-foreground">Nome</label>
        <Input
          value={modelo.nome}
          onChange={(e) => onChange({ ...modelo, nome: e.target.value })}
        />
      </div>

      <div>
        <label className="text-caption text-muted-foreground">Variáveis</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {VARIAVEIS_MENSAGEM.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => insertVar(k)}
              className="text-caption px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              {`{{${k}}}`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="text-caption text-muted-foreground">Corpo</label>
          <span
            className={
              "text-caption " +
              (len > LIMITE ? "text-destructive" : "text-muted-foreground")
            }
          >
            {len}/{LIMITE}
          </span>
        </div>
        <Textarea
          ref={ref}
          value={modelo.corpo}
          onChange={(e) => onChange({ ...modelo, corpo: e.target.value })}
          rows={6}
          className="mt-1"
        />
      </div>

      <div>
        <label className="text-caption text-muted-foreground">Prévia</label>
        <div className="mt-1 rounded-2xl bg-secondary/50 p-4 text-body whitespace-pre-wrap min-h-[80px]">
          {preview || (
            <span className="text-muted-foreground">Sem conteúdo</span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Switch
            checked={modelo.ativo}
            onCheckedChange={(v) => onChange({ ...modelo, ativo: v })}
          />
          <span className="text-label">Ativo</span>
        </div>
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
