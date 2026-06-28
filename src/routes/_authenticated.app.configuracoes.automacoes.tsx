import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { SegmentedControl } from "@/components/brand/SegmentedControl";
import { ModeloEditor } from "@/components/automacoes/ModeloEditor";
import { JanelaConfigForm } from "@/components/automacoes/JanelaConfigForm";
import { ReguasTab } from "@/components/automacoes/ReguasTab";
import { PainelMetricas } from "@/components/automacoes/PainelMetricas";
import { DiagnosticoTab } from "@/components/automacoes/DiagnosticoTab";
import {
  useModelos,
  useUpdateModelo,
  useCreateModelo,
  useDeleteModelo,
  type Modelo,
} from "@/hooks/useMensagens";
import { MODELO_TIPOS, type ModeloTipo } from "@/lib/templates";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

type Tab = "reguas" | "modelos" | "janela" | "metricas" | "diagnostico";

export const Route = createFileRoute(
  "/_authenticated/app/configuracoes/automacoes",
)({
  component: AutomacoesPage,
});

function AutomacoesPage() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const [tab, setTab] = useState<Tab>("reguas");
  const { data: modelos } = useModelos();
  const update = useUpdateModelo();
  const createModelo = useCreateModelo();
  const deleteModelo = useDeleteModelo();
  const [tipo, setTipo] = useState<ModeloTipo>("confirmacao");
  const [variantId, setVariantId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Modelo | null>(null);

  const variants = useMemo(
    () => (modelos ?? []).filter((m) => m.tipo === tipo),
    [modelos, tipo],
  );

  // Mantém variantId válida quando o tipo muda
  useEffect(() => {
    if (!variants.length) {
      setVariantId(null);
      return;
    }
    if (!variantId || !variants.find((v) => v.id === variantId)) {
      setVariantId(variants[0].id);
    }
  }, [variants, variantId]);

  const selected = useMemo(
    () => variants.find((m) => m.id === variantId) ?? null,
    [variants, variantId],
  );

  useEffect(() => {
    setDraft(selected ? { ...selected } : null);
  }, [selected?.id]);

  if (isAdmin === false) {
    return (
      <div className="px-5 pt-10 text-center text-muted-foreground">
        Acesso restrito a administradores.
      </div>
    );
  }

  const handleNovaVariante = async () => {
    try {
      const n = variants.length + 1;
      const novo = await createModelo.mutateAsync({
        nome: `Variante ${n}`,
        tipo,
        corpo: "",
        ativo: true,
      });
      setVariantId(novo.id);
      toast.success("Variante criada");
    } catch (e) {
      toast.error("Falha ao criar variante", { description: (e as Error).message });
    }
  };

  const handleExcluirVariante = async () => {
    if (!selected) return;
    if (!confirm(`Excluir "${selected.nome}"?`)) return;
    try {
      await deleteModelo.mutateAsync(selected.id);
      setVariantId(null);
      toast.success("Variante excluída");
    } catch (e) {
      toast.error("Falha ao excluir", { description: (e as Error).message });
    }
  };

  return (
    <div className="pb-24">
      <header className="px-5 pt-6 pb-3 flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/app" })}
          className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-secondary"
          aria-label="Voltar"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-h1">Automações</h1>
      </header>

      <div className="px-5">
        <SegmentedControl
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          options={[
            { value: "reguas", label: "Réguas" },
            { value: "modelos", label: "Modelos" },
            { value: "janela", label: "Janela" },
            { value: "metricas", label: "Métricas" },
            { value: "diagnostico", label: "Diagnóstico" },
          ]}
        />
      </div>

      <div className="px-5 mt-5">
        {tab === "reguas" ? <ReguasTab /> : null}
        {tab === "janela" ? <JanelaConfigForm /> : null}
        {tab === "metricas" ? <PainelMetricas /> : null}
        {tab === "diagnostico" ? <DiagnosticoTab /> : null}
        {tab === "modelos" ? (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-caption text-muted-foreground">Tipo</label>
              <select
                value={tipo}
                onChange={(e) => {
                  setTipo(e.target.value as ModeloTipo);
                  setVariantId(null);
                }}
                className="mt-1 w-full h-10 rounded-xl border border-input bg-background px-3 text-body"
              >
                {MODELO_TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-caption text-muted-foreground">
                  Variante ({variants.length})
                </label>
                <div className="flex gap-2">
                  {selected ? (
                    <button
                      onClick={handleExcluirVariante}
                      className="h-8 px-2 rounded-lg text-caption text-destructive hover:bg-destructive/10 inline-flex items-center gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </button>
                  ) : null}
                  <button
                    onClick={handleNovaVariante}
                    className="h-8 px-2 rounded-lg text-caption text-primary hover:bg-primary/10 inline-flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Nova variante
                  </button>
                </div>
              </div>
              <select
                value={variantId ?? ""}
                onChange={(e) => setVariantId(e.target.value || null)}
                className="mt-1 w-full h-10 rounded-xl border border-input bg-background px-3 text-body"
              >
                {variants.length === 0 ? (
                  <option value="">Nenhuma variante</option>
                ) : null}
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome} {v.ativo ? "" : "(inativa)"}
                  </option>
                ))}
              </select>
              <p className="text-caption text-muted-foreground mt-1">
                O sistema sorteia aleatoriamente entre as variantes ativas a cada envio.
              </p>
            </div>

            {draft ? (
              <ModeloEditor
                modelo={draft}
                onChange={setDraft}
                saving={update.isPending}
                onSave={async () => {
                  try {
                    await update.mutateAsync(draft);
                    toast.success("Modelo salvo");
                  } catch (e) {
                    toast.error("Falha ao salvar", {
                      description: (e as Error).message,
                    });
                  }
                }}
              />
            ) : (
              <div className="text-caption text-muted-foreground">
                Sem variantes para este tipo. Clique em "Nova variante" para criar.
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

