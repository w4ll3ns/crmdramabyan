export const VARIAVEIS_MENSAGEM = [
  "nome",
  "primeiro_nome",
  "data",
  "hora",
  "procedimento",
  "profissional",
  "valor",
  "nome_clinica",
] as const;

export type VariavelMensagem = (typeof VARIAVEIS_MENSAGEM)[number];

export const MOCK_VARS: Record<string, string> = {
  nome: "Maria Silva",
  primeiro_nome: "Maria",
  data: "28/06/2026",
  hora: "14:30",
  procedimento: "Avaliação",
  profissional: "Dra. Ramabyan",
  valor: "R$ 350,00",
  nome_clinica: "Clínica Ramabyan",
};

export function renderTemplate(corpo: string, vars: Record<string, unknown>) {
  let out = corpo || "";
  for (const [k, v] of Object.entries(vars || {})) {
    out = out.replaceAll(`{{${k}}}`, String(v ?? ""));
  }
  return out;
}

export const MODELO_TIPOS = [
  { value: "boas_vindas", label: "Boas-vindas" },
  { value: "confirmacao", label: "Confirmação" },
  { value: "lembrete", label: "Lembrete" },
  { value: "pos_procedimento", label: "Pós-procedimento" },
  { value: "retorno", label: "Retorno" },
  { value: "recall", label: "Recall" },
  { value: "aniversario", label: "Aniversário" },
  { value: "reativacao", label: "Reativação" },
  { value: "no_show", label: "No-show" },
  { value: "manual", label: "Manual" },
] as const;

export type ModeloTipo = (typeof MODELO_TIPOS)[number]["value"];
