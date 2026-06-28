# Anexos do aparelho + gravação de áudio na conversa

Hoje o botão de anexo só aceita URL pública. Vamos trocar por upload real do aparelho (foto, vídeo, documento) e adicionar um botão de microfone que grava áudio igual ao WhatsApp.

## 1. Storage no backend

Criar bucket privado `chat-media` (Lovable Cloud) com policies:
- `authenticated` pode `INSERT` em `chat-media/<auth.uid()>/...`
- `authenticated` pode `SELECT` apenas dos próprios arquivos
- Arquivos enviados para a Z-API precisam de URL pública temporária → geramos **Signed URL** (ex.: 7 dias) e usamos essa URL como `media_url` no `zapi-send`.

Sem mudanças no schema de `messages` — já guarda `media_url` e `media_mime_type`.

## 2. Tela da conversa (`_authenticated.app.conversas.$conversaId.tsx`)

Substituir o `BottomSheet` de "Anexo" atual por uma ação que abre o seletor nativo do aparelho:

- Botão clipe (📎) abre BottomSheet com 3 opções:
  - **Foto/Vídeo da galeria** → `<input type="file" accept="image/*,video/*">`
  - **Câmera** → `<input type="file" accept="image/*" capture="environment">`
  - **Documento** → `<input type="file" accept="application/pdf,.doc,.docx,.xls,.xlsx,.txt">`
- Ao escolher: mostra preview (thumb da imagem/nome do arquivo) + campo de legenda opcional + botão Enviar.
- Fluxo de envio:
  1. Upload do `File` para `chat-media/<userId>/<conversaId>/<uuid>.<ext>` via `supabase.storage`.
  2. Gera `createSignedUrl` (7 dias).
  3. Chama `zapi-send` com `type` derivado do mime (`image|video|document|audio`), `media_url` = signed URL, `media_mime_type`, `filename`, `content` = legenda.
- Indicador de progresso (Progress) durante upload.
- Validação de tamanho (limite 16 MB — limite prático da Z-API/WhatsApp).

## 3. Gravação de áudio estilo WhatsApp

Novo botão de microfone que aparece **no lugar do botão Enviar quando o input de texto está vazio** (igual WhatsApp). Quando há texto, mostra Enviar; sem texto, mostra Microfone.

Comportamento:
- **Press-and-hold (touch/mouse)** no microfone → começa a gravar usando `MediaRecorder` (`audio/webm;codecs=opus` quando suportado, fallback `audio/mp4` no iOS Safari).
- Durante a gravação: o input vira uma faixa com timer (`0:03`), ícone vermelho pulsando, e dica "← arraste para cancelar".
- **Soltar** → para a gravação, faz upload e envia (`type: "audio"`).
- **Arrastar para a esquerda** (> 80px) ou soltar fora → cancela e descarta.
- Pedido de permissão de microfone na primeira gravação; se negado, toast explicando.
- Alternativa para acessibilidade: toque curto no mic abre modo "tap to record" com botões Parar/Cancelar (cobre desktop sem hold confortável).

Após upload do blob:
1. Upload em `chat-media/<userId>/<conversaId>/<uuid>.ogg` (ou `.m4a`).
2. Signed URL → `zapi-send` com `type:"audio"`, `media_mime_type` correto.
3. Mostra bolha de áudio com `<audio controls>` (já existe no `Bubble`).

## 4. Detalhes técnicos

- Novo componente `AttachmentSheet` e hook `useAudioRecorder` (em `src/components/conversa/` e `src/hooks/`).
- Helper `uploadChatMedia(file, conversaId)` em `src/lib/chatMedia.ts` que faz upload + signed URL e retorna `{ url, mime, filename, type }`.
- `zapi-send` **não muda** — continua recebendo `media_url`.
- iOS Safari: `MediaRecorder` precisa de `audio/mp4` fallback; testar o mime suportado com `MediaRecorder.isTypeSupported`.
- Mobile: o botão de microfone usa `onPointerDown/Up/Move` (cobre touch + mouse) com `setPointerCapture`.

## 5. Validação

- Enviar foto da galeria → aparece bolha com imagem e chega no WhatsApp do paciente.
- Tirar foto pela câmera → idem.
- Enviar PDF → bolha com ícone de documento e nome.
- Segurar microfone 3s e soltar → bolha de áudio reproduzível, paciente recebe áudio.
- Segurar microfone e arrastar para esquerda → cancela sem enviar.
- Sem permissão de microfone → toast claro pedindo para permitir.

Sem mudanças em rotas, edge functions de webhook ou schema de banco.
