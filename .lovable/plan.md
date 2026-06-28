# Player de áudio estilo WhatsApp + visualização de mídia na conversa

Hoje o `Bubble` mostra mídia com elementos HTML crus (`<audio controls>`, `<img>`, `<video controls>`, link de documento). Vamos trocar por componentes próprios que se parecem com o WhatsApp e suportam download.

## 1. `AudioPlayer` (novo componente)

`src/components/conversa/AudioPlayer.tsx` — player customizado para áudios recebidos e enviados.

Layout (horizontal, dentro da bolha):
- Botão circular **Play/Pause** (44px) à esquerda.
- **Barra de progresso** (track fino + thumb) clicável e arrastável (`<input type="range">` estilizado) que mostra a posição.
- **Tempo** à direita: enquanto parado mostra duração total; durante a reprodução mostra tempo restante (`-0:12`), igual WhatsApp.
- Botão **Download** (ícone seta) no canto que dispara download do arquivo (fetch do blob + `URL.createObjectURL` + `<a download>` para forçar mesmo em URL assinada).
- Cores: usa tokens do tema (`bg-primary/15` herdado da bolha; track `bg-muted-foreground/30`, fill `bg-primary`).

Comportamento:
- Usa `<audio>` invisível interno, lê `duration`, `currentTime`, dispara `timeupdate`.
- Lida com `duration = Infinity` de WebM/OGG: faz seek hack (`audio.currentTime = 1e9`) para forçar a duração antes de exibir.
- Só um player tocando por vez: um event bus simples (módulo singleton com `Set<HTMLAudioElement>`) pausa os outros ao dar play.
- Mantém o áudio carregado em `preload="metadata"` para não baixar tudo de cara.

Substitui o `<audio controls>` atual em `Bubble`.

## 2. `ImageMessage`, `VideoMessage`, `DocumentMessage` (no mesmo arquivo `MediaBubble.tsx`)

`src/components/conversa/MediaBubble.tsx`:

**ImageMessage**:
- Thumb com `object-cover`, `max-h-72`, borda arredondada.
- Clique abre **Lightbox** (Dialog full-screen do shadcn) com a imagem grande, botão Fechar e botão Download (mesma lógica blob-download).
- Mostra um pequeno ícone de download flutuando no canto inferior direito da thumb também.

**VideoMessage**:
- `<video>` com poster (primeiro frame via `preload="metadata"` + `#t=0.1`) e `controls`.
- Botão **Download** sobreposto no canto.
- `max-h-72`, `rounded-xl`, `bg-black`.

**DocumentMessage**:
- Card com ícone grande do tipo (`FileText` para PDF/doc, `FileSpreadsheet` para xls, `File` genérico).
- Nome do arquivo (do `filename` quando disponível ou derivado da URL).
- Tamanho/extensão em texto pequeno (extensão extraída da URL/filename).
- Dois botões pequenos: **Abrir** (link `target="_blank"`) e **Baixar** (download via blob).

## 3. Helper `downloadMedia(url, filename)`

`src/lib/downloadMedia.ts`:
- `fetch(url)` → `blob()` → cria `<a>` com `download={filename}` e clica.
- Fallback: se o fetch falhar (CORS na URL assinada), abre `window.open(url)` como degradação.
- Deriva filename quando não fornecido: último segmento do path da URL.

## 4. Ajustes em `Bubble`

`src/routes/_authenticated.app.conversas.$conversaId.tsx`:
- Importa `AudioPlayer`, `ImageMessage`, `VideoMessage`, `DocumentMessage`.
- Para `audio`: passa também `direction` (cor do botão muda em outbound) e usa o `filename` se existir no `media_url`.
- Para documento, deixa de embutir o `content_text` como nome — usa `filename` real; mantém legenda em parágrafo abaixo se `content_text` existir e for diferente.
- Bolha de mídia sem padding nas bordas quando for imagem/vídeo (já tem `rounded-xl` interno), preserva padding para áudio e documento.

## 5. Detalhes técnicos

- Nenhuma mudança no schema, edge functions ou rotas.
- Não muda o fluxo de envio; só a renderização das mensagens recebidas/enviadas.
- O áudio gravado pelo usuário (WebM/OGG/MP4) usa o mesmo player — o hack de duração cobre os três casos.
- Lightbox usa o `Dialog` do shadcn já presente, sem nova dep.
- Ícones: `Play`, `Pause`, `Download`, `X`, `FileText`, `FileSpreadsheet`, `File` (todos do `lucide-react` já em uso).

## 6. Validação

- Áudio recebido toca/pausa com botão; barra avança; tempo restante decresce.
- Clique na barra faz seek.
- Tocar outro áudio pausa o anterior.
- Botão de download salva o arquivo localmente com nome correto.
- Imagem abre em lightbox; download funciona dentro do lightbox.
- Vídeo reproduz inline; botão de download baixa o arquivo.
- Documento mostra nome + extensão e abre/baixa.
