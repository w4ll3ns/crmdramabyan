import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { BottomSheet } from "@/components/brand/BottomSheet";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  type Paciente,
  useUpsertPaciente,
} from "@/hooks/usePacienteFicha";
import { toast } from "sonner";

export function PacienteSheet({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Paciente | null;
  onSaved?: (id: string) => void;
}) {
  const isEdit = !!initial?.id;
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [sexo, setSexo] = useState("");
  const [lgpd, setLgpd] = useState(false);
  const [imagem, setImagem] = useState(false);
  const upsert = useUpsertPaciente();

  useEffect(() => {
    if (!open) return;
    setNome(initial?.nome ?? "");
    setTelefone(initial?.telefone ?? "");
    setWhatsapp(initial?.whatsapp ?? "");
    setNascimento(initial?.data_nascimento ?? "");
    setSexo(initial?.sexo ?? "");
    setLgpd(initial?.consentimento_lgpd ?? false);
    setImagem(initial?.consentimento_imagem ?? false);
  }, [open, initial]);

  async function handleSave() {
    if (!nome.trim()) {
      toast.error("Informe o nome");
      return;
    }
    try {
      const id = await upsert.mutateAsync({
        id: initial?.id,
        nome: nome.trim(),
        telefone: telefone.trim() || null,
        whatsapp: whatsapp.trim() || telefone.trim() || null,
        data_nascimento: nascimento || null,
        sexo: sexo || null,
        consentimento_lgpd: lgpd,
        consentimento_imagem: imagem,
      });
      toast.success(isEdit ? "Paciente atualizado" : "Paciente criado");
      onOpenChange(false);
      onSaved?.(id);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    }
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Editar paciente" : "Novo paciente"}
    >
      <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-1">
        <Field label="Nome">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus className="h-11" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefone">
            <Input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              inputMode="tel"
              className="h-11"
            />
          </Field>
          <Field label="WhatsApp">
            <Input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              inputMode="tel"
              className="h-11"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nascimento">
            <Input
              type="date"
              value={nascimento}
              onChange={(e) => setNascimento(e.target.value)}
              className="h-11"
            />
          </Field>
          <Field label="Sexo">
            <Input
              value={sexo}
              onChange={(e) => setSexo(e.target.value)}
              placeholder="F / M / Outro"
              className="h-11"
            />
          </Field>
        </div>

        <div className="rounded-2xl border border-border bg-card divide-y divide-border">
          <label className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <div className="text-label">Consentimento LGPD</div>
              <div className="text-caption text-muted-foreground">
                Necessário para registrar fotos.
              </div>
            </div>
            <Switch checked={lgpd} onCheckedChange={setLgpd} />
          </label>
          <label className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <div className="text-label">Consentimento de imagem</div>
              <div className="text-caption text-muted-foreground">
                Permite marcar foto para divulgação.
              </div>
            </div>
            <Switch checked={imagem} onCheckedChange={setImagem} />
          </label>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-6 mt-4 px-6 pt-3 pb-2 bg-card border-t border-border">
        <Button
          onClick={handleSave}
          disabled={upsert.isPending}
          className="w-full h-12"
        >
          {upsert.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isEdit ? (
            "Salvar"
          ) : (
            "Criar paciente"
          )}
        </Button>
      </div>
    </BottomSheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-caption text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
