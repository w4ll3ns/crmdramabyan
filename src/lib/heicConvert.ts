// Conversão HEIC/HEIF → JPEG no navegador (client-only).
// `heic2any` é importado dinamicamente para não pesar o bundle inicial
// e para nunca executar durante o SSR.

const cache = new Map<string, Promise<string>>();

export function isHeic(nameOrMime: string): boolean {
  const s = nameOrMime.toLowerCase();
  return (
    s.endsWith(".heic") ||
    s.endsWith(".heif") ||
    s === "image/heic" ||
    s === "image/heif" ||
    s.includes("/heic") ||
    s.includes("/heif")
  );
}

export function convertHeicToJpegUrl(src: string): Promise<string> {
  const cached = cache.get(src);
  if (cached) return cached;

  const p = (async () => {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`HEIC fetch falhou (${res.status})`);
    const blob = await res.blob();
    const mod = await import("heic2any");
    const heic2any = (mod as { default: (opts: any) => Promise<Blob | Blob[]> }).default;
    const out = await heic2any({ blob, toType: "image/jpeg", quality: 0.85 });
    const jpegBlob = Array.isArray(out) ? out[0] : out;
    return URL.createObjectURL(jpegBlob);
  })();

  // Em caso de erro, remove do cache para permitir nova tentativa.
  p.catch(() => cache.delete(src));
  cache.set(src, p);
  return p;
}
