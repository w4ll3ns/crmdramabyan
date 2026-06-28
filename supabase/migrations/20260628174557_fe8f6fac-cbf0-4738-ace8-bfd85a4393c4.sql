
-- Enums
DO $$ BEGIN
  CREATE TYPE public.modelo_tipo AS ENUM ('boas_vindas','confirmacao','lembrete','pos_procedimento','retorno','recall','aniversario','reativacao','no_show','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.msg_status AS ENUM ('pendente','enviada','cancelada','falhou','respondida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.msg_origem AS ENUM ('automacao','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- modelos_mensagem
CREATE TABLE IF NOT EXISTS public.modelos_mensagem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo public.modelo_tipo NOT NULL,
  corpo text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS modelos_mensagem_tipo_ativo_idx
  ON public.modelos_mensagem (tipo) WHERE ativo;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.modelos_mensagem TO authenticated;
GRANT ALL ON public.modelos_mensagem TO service_role;
ALTER TABLE public.modelos_mensagem ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modelos_select_auth" ON public.modelos_mensagem
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "modelos_insert_admin" ON public.modelos_mensagem
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "modelos_update_admin" ON public.modelos_mensagem
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "modelos_delete_admin" ON public.modelos_mensagem
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_modelos_updated_at BEFORE UPDATE ON public.modelos_mensagem
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- mensagens_agendadas
CREATE TABLE IF NOT EXISTS public.mensagens_agendadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  agendamento_id uuid REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  modelo_id uuid REFERENCES public.modelos_mensagem(id) ON DELETE SET NULL,
  tipo public.modelo_tipo NOT NULL DEFAULT 'manual',
  conteudo_renderizado text NOT NULL DEFAULT '',
  variaveis jsonb NOT NULL DEFAULT '{}'::jsonb,
  agendado_para timestamptz NOT NULL,
  status public.msg_status NOT NULL DEFAULT 'pendente',
  tentativas int NOT NULL DEFAULT 0,
  enviada_em timestamptz,
  erro text,
  origem public.msg_origem NOT NULL DEFAULT 'manual',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mensagens_agendadas_status_para_idx
  ON public.mensagens_agendadas (status, agendado_para);
CREATE INDEX IF NOT EXISTS mensagens_agendadas_paciente_idx
  ON public.mensagens_agendadas (paciente_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensagens_agendadas TO authenticated;
GRANT ALL ON public.mensagens_agendadas TO service_role;
ALTER TABLE public.mensagens_agendadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ma_select_auth" ON public.mensagens_agendadas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ma_insert_auth" ON public.mensagens_agendadas
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ma_update_auth" ON public.mensagens_agendadas
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ma_delete_admin" ON public.mensagens_agendadas
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_mensagens_agendadas_updated_at BEFORE UPDATE ON public.mensagens_agendadas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- render_template
CREATE OR REPLACE FUNCTION public.render_template(template text, vars jsonb)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  result text := COALESCE(template,'');
  k text;
  v text;
BEGIN
  IF vars IS NULL THEN RETURN result; END IF;
  FOR k, v IN SELECT key, value FROM jsonb_each_text(vars) LOOP
    result := replace(result, '{{' || k || '}}', COALESCE(v,''));
  END LOOP;
  RETURN result;
END $$;

-- Seeds: settings defaults
INSERT INTO public.settings (chave, valor) VALUES
  ('automacoes_janela_inicio', '"08:00"'::jsonb),
  ('automacoes_janela_fim', '"20:00"'::jsonb),
  ('automacoes_fuso', '"America/Fortaleza"'::jsonb),
  ('automacoes_limite_minuto', '8'::jsonb),
  ('automacoes_palavra_optout', '"sair"'::jsonb),
  ('automacoes_pausado', 'false'::jsonb)
ON CONFLICT (chave) DO NOTHING;

-- Seeds: 1 modelo por tipo (corpo neutro)
INSERT INTO public.modelos_mensagem (nome, tipo, corpo, ativo) VALUES
  ('Boas-vindas', 'boas_vindas', 'Olá {{primeiro_nome}}! Bem-vindo(a) à {{nome_clinica}}. Estamos à disposição.', true),
  ('Confirmação de agendamento', 'confirmacao', 'Olá {{primeiro_nome}}, confirmando seu {{procedimento}} em {{data}} às {{hora}} com {{profissional}}. Posso confirmar?', true),
  ('Lembrete', 'lembrete', 'Oi {{primeiro_nome}}, lembrete do seu {{procedimento}} amanhã ({{data}}) às {{hora}}. Até lá!', true),
  ('Pós-procedimento', 'pos_procedimento', 'Olá {{primeiro_nome}}, tudo bem após o procedimento? Qualquer dúvida estou aqui.', true),
  ('Retorno', 'retorno', 'Oi {{primeiro_nome}}, está na hora do seu retorno. Quer agendar?', true),
  ('Recall', 'recall', 'Olá {{primeiro_nome}}, faz um tempinho que não nos vemos. Que tal agendar uma avaliação?', true),
  ('Aniversário', 'aniversario', 'Feliz aniversário, {{primeiro_nome}}! Desejamos um ótimo dia. — {{nome_clinica}}', true),
  ('Reativação', 'reativacao', 'Oi {{primeiro_nome}}, sentimos sua falta. Posso te ajudar a reagendar?', true),
  ('No-show', 'no_show', 'Olá {{primeiro_nome}}, notamos que não conseguiu comparecer hoje. Quer remarcar?', true),
  ('Manual', 'manual', '', true)
ON CONFLICT DO NOTHING;
