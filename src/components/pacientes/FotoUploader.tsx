import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { BottomSheet } from "@/components/brand/BottomSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { SegmentedControl } from "@/components/brand/SegmentedControl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type FotoAngulo,
  type FotoCategoria,
  useUploadFoto,
} from "@/hooks/usePacienteFicha";
import { useProcedimentos } from "@/hooks/useAgenda";
import { toast } from "sonner";

export function FotoUploader({
  open,
  onOpenChange,
  pacienteId,
  canConsent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pacienteId: string;
  canConsent: boolean; // paciente.consentimento_imagem
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [categoria, setCategoria] = useState<FotoCategoria>("antes");
  const [angulo, setAngulo] = useState<FotoAngulo>("frontal");
  const [procedimentoId, setProcedimentoId] = useState<string | null>(null);
  const [consentUso, setConsentUso] = useState(false);
  const [obs, setObs] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const upload = useUploadFoto();
  const { data: procs } = useProcedimentos();

  function reset() {
    setFiles([]);
    setCategoria("antes");
    setAngulo("frontal");
    setProcedimentoId(null);
    setConsentUso(false);
    setObs("");
  }

  async function handleSave() {
    if (!files.length) {
      toast.error("Selecione ao menos uma foto");
      return;
    }
    try {
      for (const file of files) {
        await upload.mutateAsync({
          paciente_id: pacienteId,
          file,
          categoria,
          angulo,
          procedimento_id: procedimentoId,
          consentimento_uso: consentUso,
          observacao: obs || null,
        });
      }
      toast.success(`${files.length} foto(s) enviada(s)`);
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no upload");
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Adicionar fotos">
      <div className="flex flex-col gap-5 max-h-[72vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-20 flex-col gap-1"
            onClick={() => cameraRef.current?.click()}
          >
            <Camera className="h-5 w-5" />
            <span className="text-caption">Câmera</span>
          </Button>
          <Button
            variant="outline"
            className="h-20 flex-col gap-1"
            onClick={() => galRef.current?.click()}
          >
            <ImagePlus className="h-5 w-5" />
            <span className="text-caption">Galeria</span>
          </Button>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) =>
              setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])
            }
          />
          <input
            ref={galRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) =>
              setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])
            }
          />
        </div>

        {files.length > 0 ? (
          <div className="text-caption text-muted-foreground">
            {files.length} arquivo(s) prontos para enviar
          </div>
        ) : null}

        <Section title="Categoria">
          <SegmentedControl<FotoCategoria>
            value={categoria}
            onChange={setCategoria}
            options={[
              { label: "Antes", value: "antes" },
              { label: "Depois", value: "depois" },
              { label: "Evolução", value: "evolucao" },
            ]}
          />
        </Section>

        <Section title="Ângulo">
          <Select value={angulo} onValueChange={(v) => setAngulo(v as FotoAngulo)}>
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="frontal">Frontal</SelectItem>
              <SelectItem value="perfil_direito">Perfil direito</SelectItem>
              <SelectItem value="perfil_esquerdo">Perfil esquerdo</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </Section>

        <Section title="Procedimento (opcional)">
          <Select
            value={procedimentoId ?? "none"}
            onValueChange={(v) => setProcedimentoId(v === "none" ? null : v)}
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Nenhum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {(procs ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Section>

        <div className="rounded-2xl border border-border bg-card px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-label">Liberar uso para divulgação</div>
            <div className="text-caption text-muted-foreground">
              {canConsent
                ? "Requer consentimento de imagem do paciente."
                : "Paciente não tem consentimento de imagem."}
            </div>
          </div>
          <Switch
            checked={consentUso}
            disabled={!canConsent}
            onCheckedChange={setConsentUso}
          />
        </div>

        <Section title="Observação">
          <Textarea
            rows={2}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Notas sobre a sessão"
          />
        </Section>
      </div>

      <div className="sticky bottom-0 -mx-6 mt-4 px-6 pt-3 pb-2 bg-card border-t border-border">
        <Button
          onClick={handleSave}
          disabled={upload.isPending || !files.length}
          className="w-full h-12"
        >
          {upload.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            `Enviar ${files.length || ""}`.trim()
          )}
        </Button>
      </div>
    </BottomSheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-caption uppercase tracking-wide text-muted-foreground mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}
