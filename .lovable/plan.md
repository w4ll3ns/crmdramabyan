## Anamnese + Fotos Antes/Depois — Ficha do Paciente

### 1. Backend (1 migração + bucket)

**Tabela `anamneses`** (1:1 com paciente)
- `paciente_id uuid UNIQUE NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE`
- Texto livre: `queixa_principal, expectativas, procedimentos_anteriores, alergias, uso_medicamentos, doencas_cronicas, contraindicacoes, observacoes_clinicas`
- Booleanos: `usa_anticoagulante, gestante_lactante, historico_herpes, historico_queloide, fumante` (default false)
- `preenchida_por uuid REFERENCES auth.users`, `created_at`, `updated_at` (trigger), atualizado_em = updated_at
- RLS: SELECT/INSERT/UPDATE para `authenticated`. DELETE só `has_role(uid,'admin')`. GRANTs para `authenticated` e `service_role`.

**Tabela `fotos_paciente`**
- `id, paciente_id (FK cascade), agendamento_id (FK set null, opcional), procedimento_id (FK set null, opcional)`
- `categoria` enum novo `foto_categoria` (`antes|depois|evolucao`)
- `angulo` enum novo `foto_angulo` (`frontal|perfil_direito|perfil_esquerdo|outro`)
- `storage_path text NOT NULL`, `data_foto timestamptz default now()`, `consentimento_uso bool default false`, `observacao text`
- `created_by uuid REFERENCES auth.users default auth.uid()`, `created_at`
- RLS: SELECT/INSERT/UPDATE para `authenticated`. DELETE só admin via `has_role`. GRANTs.

**Bucket `fotos-pacientes`** (privado) via `supabase--storage_create_bucket`.
Policies em `storage.objects` (path = `paciente_id/...`):
- SELECT/INSERT para `authenticated` quando `bucket_id='fotos-pacientes'`
- DELETE só `has_role(uid,'admin')`

**Função `request_signed_foto_url(foto_id uuid)`** — não, signed URL é gerada client-side via `supabase.storage.from(...).createSignedUrl(path, 300)`; nada no servidor.

**Trigger de validação** em `fotos_paciente` antes do INSERT:
- bloqueia se `paciente.consentimento_lgpd = false`
- bloqueia se `consentimento_uso = true` e `paciente.consentimento_imagem = false`

### 2. Hooks (`src/hooks/usePacienteFicha.ts`)
- `usePaciente(id)` — dados + flags de consentimento
- `useAnamnese(pacienteId)` + `useUpsertAnamnese()`
- `useFotos(pacienteId)` agrupado por `data_foto` (sessão)
- `useUploadFoto()` — sobe arquivo em `${pacienteId}/${uuid}.${ext}`, insere linha
- `useSignedFotoUrl(path)` — cache curto (4 min), `createSignedUrl(path, 300)`
- `useDeleteFoto()` — admin only; remove Storage + linha + grava `audit_logs` (`entity='foto_paciente', action='delete'`)
- `useIsAdmin()` — checa `user_roles`

### 3. Rotas e UI

**Lista** — reescrever `src/routes/_authenticated.app.pacientes.tsx`
- Busca por nome/telefone (ilike), `Avatar`+nome+telefone, chips de consentimento
- FAB "+ Paciente" abrindo `BottomSheet` (campos básicos: nome, telefone/whatsapp, nascimento, sexo, consentimentos LGPD/imagem)
- Linha clicável → `/app/pacientes/$pacienteId`

**Detalhe** — `src/routes/_authenticated.app.pacientes.$pacienteId.tsx`
- `AppHeader` com nome + voltar
- Card header: avatar, telefone, nascimento, chips de consentimento, botão "WhatsApp"
- `SegmentedControl` 3 abas: **Resumo | Anamnese | Fotos**

**Aba Resumo** — dados pessoais editáveis (sheet) + últimos agendamentos.

**Aba Anamnese** — `components/pacientes/AnamneseForm.tsx`
- Todos os campos do enunciado, switches para boolean, textareas para texto livre
- Botão "Salvar" fixo no rodapé; mostra "Atualizado em ..." e "Preenchida por ..."

**Aba Fotos** — `components/pacientes/FotosTab.tsx`
- Banner de bloqueio se `!consentimento_lgpd` (esconde uploader)
- Botão "Adicionar foto" → `BottomSheet` com `<input type="file" accept="image/*" capture="environment" multiple>` (câmera ou galeria no mobile), seletor de categoria/ângulo, procedimento opcional, switch consentimento_uso (bloqueado se `!consentimento_imagem`), observação
- Galeria agrupada por data (sessão); thumbs usam signed URL
- Tap → visualizador fullscreen com tabs categoria (antes/depois/evolução)
- Botão "Comparar antes/depois" abre `BeforeAfterSlider` (seleciona uma "antes" + uma "depois", arrastar divisor horizontal)
- Botão admin (só com role) "Excluir dados de imagem" em cada foto, com confirmação

**Componentes novos**
- `components/pacientes/AnamneseForm.tsx`
- `components/pacientes/FotosTab.tsx`
- `components/pacientes/FotoUploader.tsx`
- `components/pacientes/FotoGaleria.tsx`
- `components/pacientes/BeforeAfterSlider.tsx` (CSS puro: clip-path + range input)
- `components/pacientes/PacienteSheet.tsx` (create/edit básico)

### 4. Segurança
- Bucket sempre privado; nenhum `getPublicUrl`. Sempre `createSignedUrl(path, 300)`.
- Validação Zod em todos os forms.
- DELETE de foto: chama RPC ou faz delete via cliente (RLS valida `has_role`); em paralelo `supabase.storage.remove([path])` e insere em `audit_logs`.
- Anamnese: nenhuma lógica clínica/alerta — só persistência.

### 5. Critérios de aceite (verificação)
- Anamnese salva e recarrega por paciente ✅
- Upload pelo celular (câmera + galeria) ✅
- Bucket privado + signed URL 5 min ✅
- Comparador antes/depois mobile ✅
- Upload bloqueado sem `consentimento_lgpd` ✅
- Foto marcada para divulgação exige `consentimento_imagem` ✅
- Exclusão só por admin, registrada em `audit_logs` ✅
