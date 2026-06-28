import type { Database } from "@/integrations/supabase/types";

export type AgendamentoStatus = Database["public"]["Enums"]["agendamento_status"];
export type AgendamentoTipo = Database["public"]["Enums"]["agendamento_tipo"];

export const STATUS_LABEL: Record<AgendamentoStatus, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  realizado: "Realizado",
  faltou: "Faltou",
  cancelado: "Cancelado",
};

export const STATUS_VARIANT: Record<
  AgendamentoStatus,
  "success" | "warning" | "danger" | "info" | "neutral"
> = {
  agendado: "neutral",
  confirmado: "info",
  realizado: "success",
  faltou: "warning",
  cancelado: "danger",
};

export const TIPO_LABEL: Record<AgendamentoTipo, string> = {
  avaliacao: "Avaliação",
  procedimento: "Procedimento",
  retorno: "Retorno",
};

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
/** Semana começando na segunda-feira. */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const dow = x.getDay(); // 0 dom..6 sab
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(x, diff);
}
export function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function fmtHora(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
export function fmtDiaCurto(d: Date): { dow: string; num: string } {
  const dow = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  const num = String(d.getDate()).padStart(2, "0");
  return { dow, num };
}
export function fmtDataLonga(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}
/** Combina data (Date) + hora "HH:mm" e devolve ISO timestamptz. */
export function combineDateTime(date: Date, hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const x = new Date(date);
  x.setHours(h || 0, m || 0, 0, 0);
  return x.toISOString();
}
