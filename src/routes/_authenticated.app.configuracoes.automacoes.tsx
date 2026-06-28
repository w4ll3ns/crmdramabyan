import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { SegmentedControl } from "@/components/brand/SegmentedControl";
import { ModeloEditor } from "@/components/automacoes/ModeloEditor";
import { JanelaConfigForm } from "@/components/automacoes/JanelaConfigForm";
import { ReguasTab } from "@/components/automacoes/ReguasTab";
import { PainelMetricas } from "@/components/automacoes/PainelMetricas";
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

type Tab = "reguas" | "modelos" | "janela" | "metricas";

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
  const [tipo, setTipo] = useState<string>("confirmacao");
  const [draft, setDraft] = useState<Modelo | null>(null);


  const selected = useMemo(
    () => modelos?.find((m) => m.tipo === tipo) ?? null,
    [modelos, tipo],
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
          ]}
        />
      </div>

      <div className="px-5 mt-5">
        {tab === "reguas" ? <ReguasTab /> : null}
        {tab === "janela" ? <JanelaConfigForm /> : null}
        {tab === "metricas" ? <PainelMetricas /> : null}
        {tab === "modelos" ? (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-caption text-muted-foreground">Tipo</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="mt-1 w-full h-10 rounded-xl border border-input bg-background px-3 text-body"
              >
                {MODELO_TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
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
                Modelo não encontrado.
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

