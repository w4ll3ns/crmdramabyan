export function filenameFromUrl(url: string, fallback = "arquivo"): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop();
    if (last) return decodeURIComponent(last);
  } catch {
    /* ignore */
  }
  return fallback;
}

export async function downloadMedia(url: string, filename?: string): Promise<void> {
  const name = filename || filenameFromUrl(url);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const obj = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = obj;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(obj), 1000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}
