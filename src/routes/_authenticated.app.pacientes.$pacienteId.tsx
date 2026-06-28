import { useState } from "react";
import {
  createFileRoute,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import {
  ArrowLeft,
  MessageCircle,
  Pencil,
  ShieldCheck,
  ShieldOff,
  Camera as CameraIcon,
  CameraOff,
  Clock,
} from "lucide-react";
import { BrandAvatar } from "@/components/brand/Avatar";
import { SegmentedControl } from "@/components/brand/SegmentedControl";
import { Button } from "@/components/ui/button";
import {
  usePaciente,
  useAgendamentosDoPaciente,
} from "@/hooks/usePacienteFicha";
import { ensureConversation } from "@/hooks/useAgenda";
import { PacienteSheet } from "@/components/pacientes/PacienteSheet";
import { AnamneseForm } from "@/components/pacientes/AnamneseForm";
import { FotosTab } from "@/components/pacientes/FotosTab";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/agenda";
import { toast } from "sonner";
import { AgendarMensagemSheet } from "@/components/automacoes/AgendarMensagemSheet";

export const Route = createFileRoute("/_authenticated/app/pacientes/$pacienteId")({
  component: PacienteDetalhePage,
});

type Tab = "resumo" | "anamnese" | "fotos";

function PacienteDetalhePage() {
  const { pacienteId } = useParams({
    from: "/_authenticated/app/pacientes/$pacienteId",
  });
  const navigate = useNavigate();
  const { data: paciente, isLoading } = usePaciente(pacienteId);
  const [tab, setTab] = useState<Tab>("resumo");
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading || !paciente) {
    return <div className="p-6 text-muted-foreground">Carregando…</div>;
  }

  async function openWhats() {
    if (!paciente) return;
    const id = await ensureConversation({
      id: paciente.id,
      nome: paciente.nome,
      foto_url: paciente.foto_url,
      telefone: paciente.telefone,
      whatsapp: paciente.whatsapp,
    });
    if (!id) {
      toast.error("Paciente sem telefone");
      return;
    }
    navigate({ to: "/app/conversas/$conversaId", params: { conversaId: id } });
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-2 pt-1">
        <button
          onClick={() => navigate({ to: "/app/pacientes" })}
          className="p-2 rounded-full hover:bg-muted"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => setEditOpen(true)}
          className="p-2 rounded-full hover:bg-muted"
          aria-label="Editar"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      <div className="px-5 pt-2 flex flex-col items-center gap-2">
        <BrandAvatar name={paciente.nome} size={72} />
        <div className="text-h2 text-center">{paciente.nome}</div>
        <div className="text-caption text-muted-foreground">
          {paciente.whatsapp || paciente.telefone || "Sem telefone"}
        </div>
        <div className="flex gap-2 mt-1">
          <ConsentBadge
            ok={paciente.consentimento_lgpd}
            okLabel="LGPD"
            offLabel="Sem LGPD"
            okIcon={<ShieldCheck className="h-3.5 w-3.5" />}
            offIcon={<ShieldOff className="h-3.5 w-3.5" />}
          />
          <ConsentBadge
            ok={paciente.consentimento_imagem}
            okLabel="Imagem"
            offLabel="Sem imagem"
            okIcon={<CameraIcon className="h-3.5 w-3.5" />}
            offIcon={<CameraOff className="h-3.5 w-3.5" />}
          />
        </div>
        <Button
          variant="outline"
          className="mt-2 h-10"
          onClick={openWhats}
        >
          <MessageCircle className="h-4 w-4" />
          Abrir conversa
        </Button>
      </div>

      <div className="px-5 pt-5 pb-3 flex justify-center">
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { label: "Resumo", value: "resumo" },
            { label: "Anamnese", value: "anamnese" },
            { label: "Fotos", value: "fotos" },
          ]}
        />
      </div>

      <div className="px-5">
        {tab === "resumo" ? (
          <ResumoTab pacienteId={pacienteId} />
        ) : tab === "anamnese" ? (
          <AnamneseForm pacienteId={pacienteId} />
        ) : (
          <FotosTab pacienteId={pacienteId} />
        )}
      </div>

      <PacienteSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={paciente}
      />
    </div>
  );
}

function ConsentBadge({
  ok,
  okLabel,
  offLabel,
  okIcon,
  offIcon,
}: {
  ok: boolean;
  okLabel: string;
  offLabel: string;
  okIcon: React.ReactNode;
  offIcon: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-caption ${
        ok
          ? "bg-success/15 text-success"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {ok ? okIcon : offIcon}
      {ok ? okLabel : offLabel}
    </span>
  );
}

function ResumoTab({ pacienteId }: { pacienteId: string }) {
  const { data } = useAgendamentosDoPaciente(pacienteId);
  return (
    <div className="flex flex-col gap-3 pb-28">
      <div className="text-caption uppercase tracking-wide text-muted-foreground">
        Agendamentos
      </div>
      {!data?.length ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-muted-foreground text-caption">
          Nenhum agendamento ainda.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((a: any) => {
            return (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-card border border-border"
              >
                <div className="min-w-0">
                  <div className="text-label truncate">
                    {a.procedimento?.nome ?? "—"}
                  </div>
                  <div className="text-caption text-muted-foreground">
                    {new Date(a.data_hora).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {a.duracao_minutos} min
                  </div>
                </div>
                <StatusBadge variant={STATUS_VARIANT[a.status as keyof typeof STATUS_VARIANT]}>
                  {STATUS_LABEL[a.status as keyof typeof STATUS_LABEL]}
                </StatusBadge>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
