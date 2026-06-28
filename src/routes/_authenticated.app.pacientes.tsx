import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Search, ShieldCheck, Camera as CameraIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Fab } from "@/components/brand/Fab";
import { BrandAvatar } from "@/components/brand/Avatar";
import { EmptyState } from "@/components/brand/EmptyState";
import { PacienteSheet } from "@/components/pacientes/PacienteSheet";
import { usePacientesList } from "@/hooks/usePacienteFicha";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/pacientes")({
  component: PacientesPage,
});

function PacientesPage() {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const { data, isLoading } = usePacientesList(term);

  return (
    <div className="flex flex-col gap-3 px-5 pt-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar paciente"
          className="pl-9 h-11"
        />
      </div>

      {isLoading ? (
        <div className="text-caption text-muted-foreground py-6 text-center">
          Carregando…
        </div>
      ) : !data?.length ? (
        <EmptyState
          icon={<Users className="h-7 w-7" strokeWidth={1.5} />}
          title="Sem pacientes"
          description="Toque em + para cadastrar."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((p) => (
            <li key={p.id}>
              <button
                onClick={() =>
                  navigate({
                    to: "/app/pacientes/$pacienteId",
                    params: { pacienteId: p.id },
                  })
                }
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-card border border-border active:bg-muted/60 text-left"
              >
                <BrandAvatar name={p.nome} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="text-label truncate">{p.nome}</div>
                  <div className="text-caption text-muted-foreground truncate">
                    {p.whatsapp || p.telefone || "Sem telefone"}
                  </div>
                </div>
                <div className="flex gap-1">
                  {p.consentimento_lgpd ? (
                    <span title="LGPD" className="p-1 rounded-full bg-success/15 text-success">
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                  {p.consentimento_imagem ? (
                    <span
                      title="Imagem"
                      className="p-1 rounded-full bg-primary/15 text-primary"
                    >
                      <CameraIcon className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="fixed right-5 bottom-[88px] z-40 mb-safe">
        <Fab onClick={() => setOpenCreate(true)} aria-label="Novo paciente">
          <Plus className="h-6 w-6" strokeWidth={1.75} />
        </Fab>
      </div>

      <PacienteSheet
        open={openCreate}
        onOpenChange={setOpenCreate}
        onSaved={(id) =>
          navigate({ to: "/app/pacientes/$pacienteId", params: { pacienteId: id } })
        }
      />
    </div>
  );
}
