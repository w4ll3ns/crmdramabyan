
# Dra. Mabyan — CRM · Fundação visual + Shell + Login + PWA

Esta etapa entrega a base: design system completo via tokens, AppShell mobile com BottomNav, tela de Login com Supabase, página /style com todos os componentes, e PWA instalável. Telas internas (Conversas, Agenda, Funil, Pacientes, Início) ficam como placeholders prontos para a próxima etapa.

> Observação sobre a stack: o projeto roda em **TanStack Start (React 19 + Vite 7 + Tailwind v4)**, não em Vite/React Router puro. A identidade, os tokens e os componentes são exatamente os pedidos; só muda o roteamento (file-based em `src/routes/`) e a forma de declarar tokens (Tailwind v4 CSS-first em `src/styles.css`, sem `tailwind.config.js`). O resultado visual é idêntico.

## 1. Design System (tokens)

Reescrever `src/styles.css` com a identidade champanhe/dourado:

- **Cores claras** (em `:root`, em `oklch` equivalente aos hex pedidos):
  `--background #FAF7F4`, `--card/popover #FFFFFF`, `--foreground #2B2522`,
  `--muted-foreground #8A7F77`, `--border #ECE5DE`, `--input #F4EEE8`,
  `--primary #C9A66B`, `--primary-hover #B98E5E`, `--primary-foreground #FFFFFF`,
  `--accent #D9A7A0`, `--success #6FA287`, `--warning #D8A24A`,
  `--danger #C76B5E`, `--ring` derivado do dourado.
- **Tema escuro** em `.dark`: `--background #1A1614`, `--card #221D1A`,
  `--foreground #F2EBE4`, primary mantém dourado.
- **Tokens semânticos extras**: `--surface-tint` (gradiente champanhe→branco do header), `--shadow-soft: 0 8px 24px rgba(43,37,34,0.06)`, `--shadow-pressed`, `--radius` base 14px, com `rounded-3xl` em cards (24px) e `rounded-xl` em botões/inputs.
- **Badges suaves**: utilities `bg-primary/12 text-primary`, idem success/warning/danger via `color-mix`.
- `@theme inline` mapeia tudo para classes Tailwind (`bg-background`, `text-primary`, `bg-success/12`, etc.). Zero hex/spacing hardcoded em componentes — regra registrada em `mem://index.md`.
- **Tipografia**: `<link>` para Google Fonts **Playfair Display** (700) e **Inter** (400/500/600) adicionado no `head` de `src/routes/__root.tsx` (Tailwind v4 não permite `@import` remoto em CSS). Tokens `--font-serif`, `--font-sans`. Escala registrada como utilities: `text-display` (30/serif), `text-h1` (24/serif), `text-h2` (20/serif), `text-body`, `text-label`, `text-caption`.

## 2. Backend — Lovable Cloud + Auth

- Ativar **Lovable Cloud** (Supabase gerenciado) para habilitar autenticação por e-mail/senha.
- Sem tabela de profiles nesta etapa (será decidido na próxima); usa apenas `auth.users`.
- Sessão lida via `supabase` client; listener `onAuthStateChange` registrado uma única vez no `__root.tsx`.
- Layout protegido gerenciado pela integração em `src/routes/_authenticated/route.tsx` (redireciona para `/auth` quando deslogado).

## 3. Estrutura de rotas (TanStack file-based)

```text
src/routes/
  __root.tsx              fontes, providers, listener de auth
  index.tsx               redirect → /app ou /auth conforme sessão
  auth.tsx                tela de Login (pública)
  style.tsx               Style Guide (pública nesta etapa, fácil de remover)
  _authenticated/
    route.tsx             gate (managed)
    app.tsx               layout AppShell + <Outlet/>
    app.index.tsx         "Início" (placeholder com saudação serif)
    app.conversas.tsx     placeholder
    app.agenda.tsx        placeholder
    app.funil.tsx         placeholder
    app.pacientes.tsx     placeholder
```

## 4. Componentes-base (`src/components/brand/`)

Todos consumindo apenas tokens. Cada um com variantes via `cva`:

- **AppShell** — header sticky com gradiente `--surface-tint`, monograma "M" dourado em círculo com anel, título "Dra. Mabyan" (serif) + subtítulo "Harmonização Facial". Conteúdo com `pt-safe`/`pb-safe` (env safe-area). Slot para FAB.
- **BottomNav** — 5 itens (Início, Conversas, Agenda, Funil, Pacientes), ícone lucide stroke 1.5, label `text-caption`. Item ativo: "pill" dourado suave (`bg-primary/12`) atrás do ícone + texto `text-primary`. Suporte a `badge` numérico. Altura ≥ 64px + safe-area.
- **FAB** — botão flutuante dourado, `rounded-full`, sombra suave, `active:scale-95`, posicionado acima do BottomNav.
- **BottomSheet** — wrapper sobre `shadcn/drawer` (vaul), com handle, padding generoso e cantos `rounded-t-3xl`.
- **ListRow** — avatar com inicial + anel dourado, título serif/sans, subtítulo `muted-foreground`, chevron à direita, área de toque ≥ 56px.
- **StatCard** — número grande em serif, label em caption, ícone opcional.
- **SectionHeader** — sticky, fundo `--background/80` com blur leve.
- **StatusBadge** — variantes `success | warning | danger | info | neutral`, fundo cor/12 + texto cor cheia.
- **Chip / FilterRow** — pills roláveis horizontalmente, snap.
- **SegmentedControl** — wrapper sobre `Tabs` com visual pill dourado no ativo.
- **Avatar** — iniciais quando sem foto (fundo champanhe `bg-primary/12`, texto grafite).
- **Skeleton / EmptyState** — EmptyState com ilustração leve (SVG inline minimalista), texto e CTA dourado.
- **Toaster** — `sonner` já presente, estilizado com tokens.
- Transições globais 200–300ms ease-out, `active:scale-95` em botões, respeitando `prefers-reduced-motion`.

## 5. Tela de Login (`/auth`)

- Layout centralizado, fundo `--background`, card branco `rounded-3xl` com `shadow-soft`.
- Topo: monograma "M" dourado + "Dra. Mabyan" (serif) + "Harmonização Facial" (caption).
- Tabs `Entrar` / `Criar conta` (SegmentedControl).
- Campos e-mail e senha (inputs `rounded-xl`, focus-ring dourado).
- Botão primário dourado full-width.
- Link "Esqueci minha senha" → chama `resetPasswordForEmail` com `redirectTo: ${origin}/reset-password` (rota `/reset-password` pública criada com formulário de nova senha via `updateUser`).
- Erros via toast sonner em tom `danger` suave.
- Após login → `navigate({ to: '/app' })`.

## 6. Style Guide (`/style`)

Página rolável, agrupada em seções com `SectionHeader`:

1. **Cores** — swatches de todos os tokens (background, surface, primary, accent, foreground, muted, border, success, warning, danger) + exemplos de badge suave.
2. **Tipografia** — display/H1/H2/body/label/caption renderizados com nome do token.
3. **Botões** — primário, secundário, ghost, destrutivo, FAB, com estados hover/active/disabled.
4. **Inputs & formulários** — input, textarea, select, switch, checkbox, radio.
5. **Cards & linhas** — StatCard, ListRow, SectionHeader.
6. **Badges & chips** — StatusBadge em todas variantes, Chips roláveis, SegmentedControl.
7. **Feedback** — Skeleton, EmptyState, Toast (botão para disparar).
8. **Sheet** — botão que abre BottomSheet de exemplo.

## 7. PWA instalável

- `public/manifest.webmanifest` com `name: "Dra. Mabyan — CRM"`, `short_name: "Mabyan"`, `theme_color: #C9A66B`, `background_color: #FAF7F4`, `display: standalone`, `start_url: /`, ícones 192/512 (gerados com monograma "M" dourado em fundo champanhe via imagegen) + `apple-touch-icon`.
- Tags `<link rel="manifest">`, `<meta name="theme-color" content="#C9A66B">`, `apple-touch-icon`, viewport com `viewport-fit=cover` adicionadas em `__root.tsx`.
- Sem service worker (manifest-only) — apenas instalável; offline não foi pedido.

## 8. Critérios de aceite (verificação no fim)

- [ ] `/style` renderiza todos os tokens e componentes.
- [ ] AppShell + BottomNav com pill dourado no ativo e safe-areas (`env(safe-area-inset-*)`).
- [ ] Login funcional com Supabase (signup, signin, reset).
- [ ] `manifest.webmanifest` válido, ícones presentes, `theme-color` dourado.
- [ ] Grep no código garante zero `#`/`bg-[#...]`/`text-white`/`bg-black` em componentes (apenas tokens).
- [ ] Build do TanStack passa.

## Próxima etapa (fora deste plano)

Implementar conteúdo real das 5 abas (Início com saudação + agenda do dia, Conversas estilo WhatsApp, Agenda com calendário, Funil kanban, Pacientes com busca), schema do banco (pacientes, agendamentos, conversas, etapas do funil) e perfil/role da Dra.

