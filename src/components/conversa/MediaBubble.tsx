import { useEffect, useState } from "react";
import {
  Download,
  X,
  FileText,
  FileSpreadsheet,
  File as FileIcon,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { downloadMedia, filenameFromUrl } from "@/lib/downloadMedia";
import { convertHeicToJpegUrl, isHeic } from "@/lib/heicConvert";
import { cn } from "@/lib/utils";


const UNSUPPORTED_IMAGE_EXT = ["tif", "tiff"];

function isUnsupportedImage(name: string) {
  const i = name.lastIndexOf(".");
  if (i < 0) return false;
  return UNSUPPORTED_IMAGE_EXT.includes(name.slice(i + 1).toLowerCase());
}

export function ImageMessage({ src, filename }: { src: string; filename?: string }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const name = filename || filenameFromUrl(src, "imagem");

  const needsHeic = isHeic(name);
  const [previewUrl, setPreviewUrl] = useState<string | null>(needsHeic ? null : src);
  const [converting, setConverting] = useState<boolean>(needsHeic);

  useEffect(() => {
    if (!needsHeic) return;
    let cancelled = false;
    let createdUrl: string | null = null;
    setConverting(true);
    convertHeicToJpegUrl(src)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        createdUrl = url;
        setPreviewUrl(url);
        setConverting(false);
      })
      .catch(() => {
        if (cancelled) return;
        setConverting(false);
        setFailed(true);
      });
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [needsHeic, src]);

  if (failed || isUnsupportedImage(name)) {
    return <DocumentMessage src={src} filename={name} caption={null} />;
  }

  if (converting || !previewUrl) {
    return (
      <div className="flex items-center gap-3 min-w-[220px] rounded-xl bg-background/40 px-3 py-3 border border-border/60">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="text-label truncate font-medium">{name}</div>
          <div className="text-[10px] text-muted-foreground">Convertendo imagem…</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative block overflow-hidden rounded-xl group"
      >
        <img
          src={previewUrl}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="max-h-72 w-full object-cover"
        />
        <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-90 group-hover:opacity-100">
          <Download className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-[96vw] max-h-[96vh] p-0 bg-black/95 border-none overflow-hidden"
        >
          <div className="relative flex items-center justify-center w-full h-[90vh]">
            <img
              src={previewUrl}
              alt={name}
              className="max-w-full max-h-full object-contain"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="absolute top-3 right-3 h-9 w-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => downloadMedia(src, name)}
              aria-label="Baixar imagem"
              className="absolute top-3 right-14 h-9 w-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
            >
              <Download className="h-5 w-5" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


export function VideoMessage({ src, filename }: { src: string; filename?: string }) {
  const name = filename || filenameFromUrl(src, "video");
  return (
    <div className="relative overflow-hidden rounded-xl bg-black">
      <video
        src={src}
        controls
        preload="metadata"
        className="max-h-72 w-full"
      />
      <button
        type="button"
        onClick={() => downloadMedia(src, name)}
        aria-label="Baixar vídeo"
        className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/80"
      >
        <Download className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toUpperCase() : "ARQUIVO";
}

function iconFor(ext: string) {
  const e = ext.toLowerCase();
  if (["pdf", "doc", "docx", "txt", "rtf"].includes(e))
    return <FileText className="h-7 w-7" strokeWidth={1.5} />;
  if (["xls", "xlsx", "csv"].includes(e))
    return <FileSpreadsheet className="h-7 w-7" strokeWidth={1.5} />;
  return <FileIcon className="h-7 w-7" strokeWidth={1.5} />;
}

export function DocumentMessage({
  src,
  filename,
  caption,
}: {
  src: string;
  filename?: string | null;
  caption?: string | null;
}) {
  const name = filename || filenameFromUrl(src, "documento");
  const ext = extOf(name);
  return (
    <div className="flex flex-col gap-2 min-w-[220px]">
      <div className="flex items-center gap-3 rounded-xl bg-background/40 px-3 py-2 border border-border/60">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          {iconFor(ext)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-label truncate font-medium">{name}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {ext}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] bg-muted hover:bg-muted/80 transition-colors",
          )}
        >
          <ExternalLink className="h-3 w-3" />
          Abrir
        </a>
        <button
          type="button"
          onClick={() => downloadMedia(src, name)}
          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Download className="h-3 w-3" />
          Baixar
        </button>
      </div>
      {caption ? (
        <div className="text-label whitespace-pre-wrap break-words">{caption}</div>
      ) : null}
    </div>
  );
}
