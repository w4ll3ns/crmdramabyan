-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'atendente');
CREATE TYPE public.origem_type AS ENUM ('instagram','indicacao','google','tiktok','site','anuncio_meta','whatsapp','passou_em_frente','outro');
CREATE TYPE public.etapa_funil AS ENUM ('novo_lead','primeiro_contato','avaliacao_agendada','avaliacao_realizada','orcamento_enviado','negociacao','procedimento_agendado','cliente','pos_procedimento','perdido');
CREATE TYPE public.oportunidade_status AS ENUM ('aberta','ganha','perdida');
CREATE TYPE public.conversation_status AS ENUM ('nao_lida','em_atendimento','aguardando','resolvida','arquivada');
CREATE TYPE public.message_direction AS ENUM ('inbound','outbound');
CREATE TYPE public.message_type AS ENUM ('text','image','audio','video','document');
CREATE TYPE public.agendamento_tipo AS ENUM ('avaliacao','procedimento','retorno');
CREATE TYPE public.agendamento_status AS ENUM ('agendado','confirmado','realizado','faltou','cancelado');
CREATE TYPE public.task_status AS ENUM ('pendente','em_andamento','concluida','cancelada');
CREATE TYPE public.task_priority AS ENUM ('baixa','media','alta','urgente');
CREATE TYPE public.temperatura_type AS ENUM ('quente','morno','frio');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- user_roles primeiro (has_role depende dela)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "user_roles_select_auth" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_admin_insert" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles_admin_update" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles_admin_delete" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text, email text, phone text, avatar_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_self_or_admin" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_update_self_or_admin" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_delete_admin" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- pacientes
CREATE TABLE public.pacientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL, telefone text, whatsapp text,
  data_nascimento date, sexo text, cpf text, email text, endereco text,
  origem public.origem_type,
  tags text[] NOT NULL DEFAULT '{}',
  observacoes text,
  consentimento_lgpd boolean NOT NULL DEFAULT false,
  consentimento_imagem boolean NOT NULL DEFAULT false,
  aceita_automacoes boolean NOT NULL DEFAULT true,
  foto_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pacientes TO authenticated;
GRANT ALL ON public.pacientes TO service_role;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pacientes_all_auth" ON public.pacientes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- procedimentos
CREATE TABLE public.procedimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  categoria text, descricao text,
  valor_padrao numeric, duracao_minutos int,
  retorno_dias int, recorrencia_dias int,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procedimentos TO authenticated;
GRANT ALL ON public.procedimentos TO service_role;
ALTER TABLE public.procedimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "procedimentos_select_auth" ON public.procedimentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "procedimentos_admin_insert" ON public.procedimentos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "procedimentos_admin_update" ON public.procedimentos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "procedimentos_admin_delete" ON public.procedimentos FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- oportunidades
CREATE TABLE public.oportunidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  procedimento_interesse_id uuid REFERENCES public.procedimentos(id) ON DELETE SET NULL,
  etapa public.etapa_funil NOT NULL DEFAULT 'novo_lead',
  temperatura public.temperatura_type,
  status public.oportunidade_status NOT NULL DEFAULT 'aberta',
  valor_estimado numeric, valor_final numeric,
  motivo_perda text,
  responsavel_interno_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  proximo_followup_em timestamptz, notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oportunidades TO authenticated;
GRANT ALL ON public.oportunidades TO service_role;
ALTER TABLE public.oportunidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oportunidades_all_auth" ON public.oportunidades FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- agendamentos
CREATE TABLE public.agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  procedimento_id uuid REFERENCES public.procedimentos(id) ON DELETE SET NULL,
  tipo public.agendamento_tipo NOT NULL,
  data_hora timestamptz NOT NULL,
  duracao_minutos int NOT NULL DEFAULT 60,
  status public.agendamento_status NOT NULL DEFAULT 'agendado',
  valor numeric, profissional text, observacoes text,
  aguardando_confirmacao boolean NOT NULL DEFAULT false,
  lembrete_enviado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agendamentos TO authenticated;
GRANT ALL ON public.agendamentos TO service_role;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agendamentos_all_auth" ON public.agendamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- conversations
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid REFERENCES public.pacientes(id) ON DELETE SET NULL,
  oportunidade_id uuid REFERENCES public.oportunidades(id) ON DELETE SET NULL,
  telefone text NOT NULL,
  status public.conversation_status NOT NULL DEFAULT 'nao_lida',
  assigned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ultima_mensagem_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversations_all_auth" ON public.conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- messages
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  direction public.message_direction NOT NULL,
  type public.message_type NOT NULL DEFAULT 'text',
  content_text text, media_url text, media_mime_type text,
  external_message_id text, status text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_all_auth" ON public.messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- tasks
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL, descricao text,
  status public.task_status NOT NULL DEFAULT 'pendente',
  prioridade public.task_priority NOT NULL DEFAULT 'media',
  due_date timestamptz,
  responsavel_interno_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  paciente_id uuid REFERENCES public.pacientes(id) ON DELETE SET NULL,
  oportunidade_id uuid REFERENCES public.oportunidades(id) ON DELETE SET NULL,
  agendamento_id uuid REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_all_auth" ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- zapi_instances
CREATE TABLE public.zapi_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_instancia text NOT NULL,
  instance_id text NOT NULL, token text NOT NULL,
  client_token text, phone_number text, status text,
  connected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zapi_instances TO authenticated;
GRANT ALL ON public.zapi_instances TO service_role;
ALTER TABLE public.zapi_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zapi_select_auth" ON public.zapi_instances FOR SELECT TO authenticated USING (true);
CREATE POLICY "zapi_admin_insert" ON public.zapi_instances FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "zapi_admin_update" ON public.zapi_instances FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "zapi_admin_delete" ON public.zapi_instances FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- webhook_events
CREATE TABLE public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL, event_type text,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz, error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_events TO authenticated;
GRANT ALL ON public.webhook_events TO service_role;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook_events_all_auth" ON public.webhook_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- audit_logs (admin only)
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL, entity text, entity_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_admin_all" ON public.audit_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- settings
CREATE TABLE public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  valor jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_select_auth" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_admin_insert" ON public.settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "settings_admin_update" ON public.settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "settings_admin_delete" ON public.settings FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- updated_at triggers
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pacientes_updated BEFORE UPDATE ON public.pacientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_procedimentos_updated BEFORE UPDATE ON public.procedimentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_oportunidades_updated BEFORE UPDATE ON public.oportunidades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_agendamentos_updated BEFORE UPDATE ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_conversations_updated BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_zapi_updated BEFORE UPDATE ON public.zapi_instances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- SEED procedimentos
INSERT INTO public.procedimentos (nome, categoria, retorno_dias, recorrencia_dias, ativo) VALUES
  ('Toxina Botulínica', 'Injetáveis', 15, 120, true),
  ('Preenchimento Labial', 'Injetáveis', NULL, 300, true),
  ('Preenchimento Facial', 'Injetáveis', NULL, 365, true),
  ('Bioestimulador de Colágeno', 'Injetáveis', NULL, 365, true),
  ('Fios de Sustentação', 'Procedimentos', NULL, 540, true),
  ('Skinbooster', 'Injetáveis', NULL, 90, true),
  ('Microagulhamento', 'Pele', NULL, 30, true),
  ('Peeling Químico', 'Pele', NULL, 30, true),
  ('Limpeza de Pele', 'Pele', NULL, 30, true),
  ('Harmonização Facial Completa', 'Pacotes', NULL, NULL, true),
  ('Lipo de Papada (enzimas)', 'Injetáveis', NULL, NULL, true),
  ('Botox Capilar', 'Capilar', NULL, NULL, true)
ON CONFLICT (nome) DO NOTHING;
