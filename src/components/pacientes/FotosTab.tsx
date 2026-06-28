import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Plus,
  Trash2,
  X,
  GitCompareArrows,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  type FotoPaciente,
  useDeleteFoto,
  useFotos,
  useIsAdmin,
  usePaciente,
  useSignedFotoUrl,
} from "@/hooks/usePacienteFicha";
import { FotoThumb } from "./FotoThumb";
import { FotoUploader } from "./FotoUploader";
import { BeforeAfterSlider } from "./BeforeAfterSlider";
import { toast } from "sonner";

function dateKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function fmtDia(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const CAT_LABEL: Record<string, string> = {
  antes: "Antes",
  depois: "Depois",
  evolucao: "Evolução",
};

export function FotosTab({ pacienteId }: { pacienteId: string }) {
  const { data: paciente } = usePaciente(pacienteId);
  const { data: fotos, isLoading } = useFotos(pacienteId);
  const { data: isAdmin } = useIsAdmin();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewer, setViewer] = useState<FotoPaciente | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [toDelete, setToDelete] = useState<FotoPaciente | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, FotoPaciente[]>();
    (fotos ?? []).forEach((f) => {
      const k = dateKey(f.data_foto);
      const arr = map.get(k) ?? [];
      arr.push(f);
      map.set(k, arr);
    });
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [fotos]);

  const hasLgpd = !!paciente?.consentimento_lgpd;

  return (
    <div className="flex flex-col gap-4 pb-28">
      {!hasLgpd ? (
        <div className="rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div>
            <div className="text-label">Sem consentimento LGPD</div>
            <div className="text-caption text-muted-foreground">
              Habilite o consentimento na ficha do paciente para registrar fotos.
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button
          className="flex-1 h-11"
          onClick={() => setUploadOpen(true)}
          disabled={!hasLgpd}
        >
          <Plus className="h-4 w-4" />
          Adicionar foto
        </Button>
        <Button
          variant="outline"
          className="flex-1 h-11"
          onClick={() => setCompareOpen(true)}
          disabled={!fotos || fotos.length < 2}
        >
          <GitCompareArrows className="h-4 w-4" />
          Comparar
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : !fotos?.length ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-muted-foreground text-caption">
          Nenhuma foto registrada ainda.
        </div>
      ) : (
        groups.map(([k, arr]) => (
          <section key={k} className="flex flex-col gap-2">
            <div className="text-caption uppercase tracking-wide text-muted-foreground">
              {fmtDia(arr[0].data_foto)}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {arr.map((f) => (
                <div key={f.id} className="relative">
                  <FotoThumb
                    path={f.storage_path}
                    alt={`${CAT_LABEL[f.categoria]} ${f.angulo}`}
                    onClick={() => setViewer(f)}
                  />
                  <div className="absolute left-1 top-1 px-1.5 py-0.5 rounded-full bg-black/55 text-white text-[10px]">
                    {CAT_LABEL[f.categoria]}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      <FotoUploader
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        pacienteId={pacienteId}
        canConsent={!!paciente?.consentimento_imagem}
      />

      {viewer ? (
        <FotoViewer
          foto={viewer}
          onClose={() => setViewer(null)}
          isAdmin={!!isAdmin}
          onAskDelete={(f) => {
            setViewer(null);
            setToDelete(f);
          }}
        />
      ) : null}

      {compareOpen ? (
        <CompareDialog
          fotos={fotos ?? []}
          onClose={() => setCompareOpen(false)}
        />
      ) : null}

      <AlertDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir dados de imagem</AlertDialogTitle>
            <AlertDialogDescription>
              A foto será removida do armazenamento e do registro. A ação fica
              registrada em auditoria e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <DeleteAction foto={toDelete} onDone={() => setToDelete(null)} />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DeleteAction({
  foto,
  onDone,
}: {
  foto: FotoPaciente | null;
  onDone: () => void;
}) {
  const del = useDeleteFoto();
  if (!foto) return null;
  return (
    <AlertDialogAction
      onClick={async (e) => {
        e.preventDefault();
        try {
          await del.mutateAsync(foto);
          toast.success("Foto excluída");
          onDone();
        } catch (err: any) {
          toast.error(err?.message ?? "Erro ao excluir");
        }
      }}
    >
      {del.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
    </AlertDialogAction>
  );
}

function FotoViewer({
  foto,
  onClose,
  isAdmin,
  onAskDelete,
}: {
  foto: FotoPaciente;
  onClose: () => void;
  isAdmin: boolean;
  onAskDelete: (f: FotoPaciente) => void;
}) {
  const { data: url } = useSignedFotoUrl(foto.storage_path);
  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button onClick={onClose} className="p-2 -ml-2" aria-label="Fechar">
          <X className="h-5 w-5" />
        </button>
        <div className="text-caption opacity-80">
          {CAT_LABEL[foto.categoria]} · {foto.angulo.replace("_", " ")}
        </div>
        {isAdmin ? (
          <button
            onClick={() => onAskDelete(foto)}
            className="p-2 -mr-2 text-destructive"
            aria-label="Excluir"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        ) : (
          <div className="w-9" />
        )}
      </div>
      <div className="flex-1 flex items-center justify-center px-4">
        {url ? (
          <img src={url} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        )}
      </div>
      {foto.observacao ? (
        <div className="px-5 py-3 text-white/85 text-caption">{foto.observacao}</div>
      ) : null}
    </div>
  );
}

function CompareDialog({
  fotos,
  onClose,
}: {
  fotos: FotoPaciente[];
  onClose: () => void;
}) {
  const antes = fotos.filter((f) => f.categoria === "antes");
  const depois = fotos.filter((f) => f.categoria === "depois");
  const [a, setA] = useState<FotoPaciente | null>(antes[0] ?? null);
  const [d, setD] = useState<FotoPaciente | null>(depois[0] ?? null);
  const { data: aUrl } = useSignedFotoUrl(a?.storage_path);
  const { data: dUrl } = useSignedFotoUrl(d?.storage_path);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button onClick={onClose} className="p-2 -ml-2" aria-label="Fechar">
          <X className="h-5 w-5" />
        </button>
        <div className="text-caption opacity-80">Comparar antes / depois</div>
        <div className="w-9" />
      </div>
      <div className="flex-1 flex items-center justify-center px-4">
        {aUrl && dUrl ? (
          <BeforeAfterSlider beforeUrl={aUrl} afterUrl={dUrl} />
        ) : (
          <div className="text-white/70 text-caption text-center px-6">
            Selecione abaixo uma foto "antes" e uma "depois".
          </div>
        )}
      </div>
      <div className="border-t border-white/10 bg-black/70 px-3 py-3 grid grid-cols-2 gap-3 text-white">
        <Picker label="Antes" fotos={antes} selected={a} onSelect={setA} />
        <Picker label="Depois" fotos={depois} selected={d} onSelect={setD} />
      </div>
    </div>
  );
}

function Picker({
  label,
  fotos,
  selected,
  onSelect,
}: {
  label: string;
  fotos: FotoPaciente[];
  selected: FotoPaciente | null;
  onSelect: (f: FotoPaciente) => void;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide opacity-70 mb-1">
        {label}
      </div>
      {fotos.length === 0 ? (
        <div className="text-caption opacity-60">Nenhuma</div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {fotos.map((f) => (
            <button
              key={f.id}
              onClick={() => onSelect(f)}
              className={`shrink-0 h-16 w-16 rounded-lg overflow-hidden ring-2 ${
                selected?.id === f.id ? "ring-primary" : "ring-transparent"
              }`}
            >
              <FotoThumb path={f.storage_path} className="rounded-lg" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
