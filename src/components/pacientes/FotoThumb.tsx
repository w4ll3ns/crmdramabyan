import { ImageOff, Loader2 } from "lucide-react";
import { useSignedFotoUrl } from "@/hooks/usePacienteFicha";
import { cn } from "@/lib/utils";

export function FotoThumb({
  path,
  alt,
  className,
  onClick,
}: {
  path: string;
  alt?: string;
  className?: string;
  onClick?: () => void;
}) {
  const { data: url, isLoading, isError } = useSignedFotoUrl(path);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative aspect-square w-full overflow-hidden rounded-xl bg-muted",
        "ring-1 ring-border active:scale-[0.98] transition-transform",
        className,
      )}
    >
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : isError || !url ? (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <ImageOff className="h-5 w-5" />
        </div>
      ) : (
        <img
          src={url}
          alt={alt ?? ""}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </button>
  );
}
