## Objetivo

Renderizar previews de imagens HEIC/HEIF (iPhone) dentro da conversa convertendo-as para JPEG no navegador, sem alterar o arquivo original no Storage — o download e o envio ao WhatsApp continuam usando o HEIC original.

## Abordagem

Usar a biblioteca `heic2any` (pura JS/WASM, ~200KB, roda no browser) carregada via **import dinâmico** apenas quando um HEIC for detectado. Isso evita pesar o bundle inicial.

A conversão acontece dentro do `ImageMessage`: ao detectar extensão `.heic`/`.heif` (ou `onError` da `<img>` por MIME desconhecido), buscamos o blob via `fetch(src)`, convertemos para JPEG e usamos um `URL.createObjectURL` como `src` do preview e do lightbox. O botão de download continua apontando para a URL assinada original.

## Mudanças

### 1. `package.json`
- Adicionar `heic2any` via `bun add heic2any`.

### 2. `src/lib/heicConvert.ts` (novo)
- `isHeic(name: string): boolean` — checa extensões `heic`/`heif`.
- `convertHeicToJpegUrl(src: string): Promise<string>` — fetch → blob → `heic2any({ blob, toType: "image/jpeg", quality: 0.85 })` → `URL.createObjectURL`. Import dinâmico de `heic2any` para code-splitting.
- Cache em `Map<string, Promise<string>>` para não reconverter a mesma URL entre re-renders/lightbox.

### 3. `src/components/conversa/MediaBubble.tsx`
- No `ImageMessage`:
  - Estado `previewUrl: string | null` (URL convertida) e `converting: boolean`.
  - Se `isHeic(name)` ou `<img onError>`: disparar `convertHeicToJpegUrl(src)`; enquanto carrega, mostrar skeleton/placeholder com nome do arquivo; em sucesso, usar `previewUrl` no `<img>` do thumb e do lightbox.
  - Se a conversão falhar, manter o fallback atual (renderiza `DocumentMessage`).
  - `downloadMedia` segue chamado com `src` original (HEIC preservado).
  - `URL.revokeObjectURL` no unmount via `useEffect` cleanup.

### 4. Sem mudanças em
- `chatMedia.ts` (upload original permanece HEIC).
- Edge function `zapi-send` (Z-API recebe o HEIC original; o WhatsApp do destinatário lida nativamente).
- Schema / RLS / Storage bucket.

## Detalhes técnicos

- `heic2any` é client-only; nunca importar no topo de arquivos compartilhados com SSR — apenas dentro da função `convertHeicToJpegUrl` com `await import("heic2any")`.
- Limite prático: `heic2any` pode levar 1–3s e usar memória significativa em imagens grandes. Mostrar estado "Convertendo…" no card.
- O cache é por URL assinada; como ela é estável durante 7 dias, evita retrabalho ao reabrir o lightbox ou rolar a lista.
- O `onError` da `<img>` ainda cobre HEIC servido com MIME genérico (`application/octet-stream`) ou outros formatos não suportados que não tenham extensão reconhecida.
