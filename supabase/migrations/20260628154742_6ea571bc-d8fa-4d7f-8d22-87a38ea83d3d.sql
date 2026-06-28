-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Índices
CREATE INDEX IF NOT EXISTS idx_conversations_ultima_msg ON public.conversations (ultima_mensagem_em DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations (status);
CREATE INDEX IF NOT EXISTS idx_conversations_telefone ON public.conversations (telefone);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_external ON public.messages (external_message_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_telefone ON public.pacientes (telefone);
CREATE INDEX IF NOT EXISTS idx_pacientes_whatsapp ON public.pacientes (whatsapp);

-- Seed inicial de modelos de mensagem (vazio para o usuário cadastrar)
INSERT INTO public.settings (chave, valor) VALUES
  ('mensagem_modelos', '[]'::jsonb)
ON CONFLICT (chave) DO NOTHING;
