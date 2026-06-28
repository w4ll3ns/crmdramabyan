ALTER TYPE public.msg_status ADD VALUE IF NOT EXISTS 'enviando' BEFORE 'enviada';

INSERT INTO public.settings(chave, valor) VALUES
  ('zapi_delay_typing_min', '3'::jsonb),
  ('zapi_delay_typing_max', '6'::jsonb),
  ('zapi_delay_message_min', '2'::jsonb),
  ('zapi_delay_message_max', '4'::jsonb),
  ('zapi_max_destinatarios_hora', '15'::jsonb),
  ('zapi_max_destinatarios_dia', '40'::jsonb),
  ('automacoes_pausa_auto', '{"ativo": false, "motivo": null, "desde": null}'::jsonb),
  ('automacoes_shadowban_cooldown_horas', '6'::jsonb)
ON CONFLICT (chave) DO NOTHING;