import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, Copy, Variable, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  VARIAVEIS_MENSAGEM,
  MOCK_VARS,
  renderTemplate,
  type VariavelMensagem,
} from "@/lib/templates";

export const Route = createFileRoute(
  "/_authenticated/app/configuracoes/variaveis",
)({
  component: VariaveisPage,
});

type Meta = {
  key: VariavelMensagem;
  descricao: string;
  origem: string;
  exigeAgendamento?: boolean;
  aviso?: string;
};

const VARIAVEIS_META: Meta[] = [
  {
    key: "nome",
    descricao: "Nome completo do paciente.",
    origem: "pacientes.nome",
  },
  {
    key: "primeiro_nome",
    descricao: "Primeiro nome do paciente (antes do primeiro espaço).",
    origem: "derivado de pacientes.nome",
  },
  {
    key: "nome_clinica",
    descricao: "Nome da clínica exibido nas mensagens.",
    origem: "settings.clinica_nome",
  },
  {
    key: "data",
    descricao: "Data do agendamento (DD/MM/AAAA, fuso America/Fortaleza).",
    origem: "agendamentos.data_hora",
    exigeAgendamento: true,
  },
  {
    key: "hora",
    descricao: "Hora do agendamento (HH:MM, fuso America/Fortaleza).",
    origem: "agendamentos.data_hora",
    exigeAgendamento: true,
  },
  {
    key: "procedimento",
    descricao: "Nome do procedimento agendado.",
    origem: "procedimentos.nome",
    exigeAgendamento: true,
  },
  {
    key: "profissional",
    descricao: "Profissional responsável pelo atendimento.",
    origem: "agendamentos.profissional",
    exigeAgendamento: true,
  },
  {
    key: "valor",
    descricao: "Valor do agendamento. Uso restrito.",
    origem: "agendamentos.valor",
    exigeAgendamento: true,
    aviso:
      "Evite usar em modelos automáticos — termos financeiros aumentam risco de shadowban. Cite o valor só quando o paciente perguntar.",
  },
];

// Garante que toda chave declarada em VARIAVEIS_MENSAGEM tem metadados.
const META_BY_KEY = new Map(VARIAVEIS_META.map((m) => [m.key, m]));
const VARIAVEIS_COMPLETAS: Meta[] = VARIAVEIS_MENSAGEM.map(
  (k) =>
    META_BY_KEY.get(k) ?? {
      key: k,
      descricao: "—",
      origem: "—",
    },
);

function VariaveisPage() {
  const navigate = useNavigate();
  const [preview, setPreview] = useState(
    "Olá {{primeiro_nome}}! Confirmando seu horário em {{nome_clinica}} no dia {{data}} às {{hora}} com {{profissional}}.",
  );

  const rendered = useMemo(() => renderTemplate(preview, MOCK_VARS), [preview]);

  const copy = async (key: string) => {
    const token = `{{${key}}}`;
    try {
      await navigator.clipboard.writeText(token);
      toast.success(`${token} copiado`);
    } catch {
      toast.error("Não foi possível copiar");
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
              <Variable className="h-5 w-5" strokeWidth={1.5} />
              Variáveis de mensagem
            </h1>
          </div>
        </div>
      </header>

      <section className="px-5 pt-4">
        <p className="text-caption text-muted-foreground max-w-prose">
          Estas chaves são substituídas no momento do envio pelos dados do
          paciente, do agendamento e da clínica. Datas e horas usam o fuso{" "}
          <strong>America/Fortaleza</strong>.
        </p>
      </section>

      <section className="px-5 mt-4 grid gap-2">
        {VARIAVEIS_COMPLETAS.map((v) => (
          <article
            key={v.key}
            className="rounded-2xl bg-card shadow-soft p-4 flex flex-col gap-2"
          >
            <div className="flex items-start gap-3">
              <button
                onClick={() => copy(v.key)}
                className="font-mono text-sm bg-muted hover:bg-muted/70 px-2 py-1 rounded-md flex items-center gap-1.5 shrink-0"
                title="Copiar"
              >
                {`{{${v.key}}}`}
                <Copy className="h-3.5 w-3.5 opacity-60" />
              </button>
              {v.exigeAgendamento ? (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded self-center">
                  Requer agendamento
                </span>
              ) : null}
            </div>
            <p className="text-caption text-foreground">{v.descricao}</p>
            <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-caption">
              <span className="text-muted-foreground">Exemplo</span>
              <span className="font-medium">{MOCK_VARS[v.key] ?? "—"}</span>
              <span className="text-muted-foreground">Origem</span>
              <span className="font-mono text-xs">{v.origem}</span>
            </div>
            {v.aviso ? (
              <div className="mt-1 rounded-lg bg-warning/10 border border-warning/30 p-2 flex gap-2 items-start">
                <AlertTriangle
                  className="h-4 w-4 text-warning mt-0.5 shrink-0"
                  strokeWidth={1.5}
                />
                <p className="text-caption text-foreground">{v.aviso}</p>
              </div>
            ) : null}
          </article>
        ))}
      </section>

      <section className="px-5 mt-6 mb-10">
        <div className="rounded-2xl bg-card shadow-soft p-4">
          <h2 className="text-label mb-2">Pré-visualização</h2>
          <p className="text-caption text-muted-foreground mb-3">
            Escreva um texto usando as variáveis acima e veja o resultado com
            valores de exemplo.
          </p>
          <textarea
            value={preview}
            onChange={(e) => setPreview(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-border bg-background p-3 text-sm font-mono"
          />
          <div className="mt-3">
            <p className="text-caption text-muted-foreground mb-1">Resultado</p>
            <div className="rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">
              {rendered || (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
