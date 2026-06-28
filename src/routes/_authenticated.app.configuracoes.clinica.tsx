import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useClinicaNome, useUpdateClinicaNome } from "@/hooks/useClinica";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export const Route = createFileRoute(
  "/_authenticated/app/configuracoes/clinica",
)({
  component: ClinicaPage,
});

function ClinicaPage() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const { data: nomeAtual, isLoading } = useClinicaNome();
  const update = useUpdateClinicaNome();
  const [nome, setNome] = useState("");

  useEffect(() => {
    if (nomeAtual !== undefined) setNome(nomeAtual);
  }, [nomeAtual]);

  const trimmed = nome.trim();
  const canSave =
    isAdmin === true &&
    trimmed.length > 0 &&
    trimmed.length <= 80 &&
    trimmed !== (nomeAtual ?? "");

  const onSave = async () => {
    try {
      await update.mutateAsync(trimmed);
      toast.success("Nome da clínica atualizado");
    } catch (e) {
      toast.error("Erro ao salvar", { description: (e as Error).message });
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
              <Building2 className="h-5 w-5" strokeWidth={1.5} />
              Dados da clínica
            </h1>
          </div>
        </div>
      </header>

      <section className="px-5 pt-4">
        <div className="rounded-2xl bg-card shadow-soft p-4">
          <label className="text-label">Nome da clínica</label>
          <p className="text-caption text-muted-foreground mt-1">
            Aparece nas mensagens como{" "}
            <span className="font-mono">{`{{nome_clinica}}`}</span>.
          </p>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={80}
            disabled={isLoading || isAdmin !== true}
            placeholder="Ex.: Clínica Ramabyan"
            className="mt-3 w-full rounded-lg border border-border bg-background p-3 text-sm disabled:opacity-60"
          />
          <div className="mt-1 text-[11px] text-muted-foreground text-right">
            {trimmed.length}/80
          </div>

          {isAdmin === false ? (
            <p className="text-caption text-muted-foreground mt-2">
              Apenas administradores podem alterar este campo.
            </p>
          ) : null}

          <div className="mt-4 flex justify-end">
            <button
              onClick={onSave}
              disabled={!canSave || update.isPending}
              className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {update.isPending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
