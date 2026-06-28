import { supabase } from "@/integrations/supabase/client";

const BUCKET = "chat-media";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 dias
export const MAX_BYTES = 16 * 1024 * 1024; // 16MB

export type MediaKind = "image" | "audio" | "video" | "document";

export function kindFromMime(mime: string): MediaKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

function extFromName(name: string, fallback = "bin") {
  const i = name.lastIndexOf(".");
  if (i < 0 || i === name.length - 1) return fallback;
  return name.slice(i + 1).toLowerCase();
}

export type UploadResult = {
  url: string;
  mime: string;
  filename: string;
  kind: MediaKind;
};

export async function uploadChatMedia(
  file: File | Blob,
  conversaId: string,
  opts?: { filename?: string; mime?: string },
): Promise<UploadResult> {
  const { data: userData, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userData.user) throw new Error("Não autenticado");

  const mime = opts?.mime || (file as File).type || "application/octet-stream";
  const filename =
    opts?.filename || (file instanceof File ? file.name : `arquivo.${mime.split("/")[1] || "bin"}`);
  const ext = extFromName(filename, mime.split("/")[1] || "bin");

  if ((file as Blob).size > MAX_BYTES) {
    throw new Error("Arquivo muito grande (máx. 16 MB).");
  }

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${userData.user.id}/${conversaId}/${id}.${ext}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: mime,
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data: signed, error: sErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (sErr || !signed?.signedUrl) throw sErr ?? new Error("Falha ao gerar URL");

  return {
    url: signed.signedUrl,
    mime,
    filename,
    kind: kindFromMime(mime),
  };
}
