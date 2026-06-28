
-- ENUMS
CREATE TYPE public.foto_categoria AS ENUM ('antes','depois','evolucao');
CREATE TYPE public.foto_angulo AS ENUM ('frontal','perfil_direito','perfil_esquerdo','outro');

-- ANAMNESES
CREATE TABLE public.anamneses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL UNIQUE REFERENCES public.pacientes(id) ON DELETE CASCADE,
  queixa_principal text,
  expectativas text,
  procedimentos_anteriores text,
  alergias text,
  uso_medicamentos text,
  usa_anticoagulante boolean NOT NULL DEFAULT false,
  gestante_lactante boolean NOT NULL DEFAULT false,
  historico_herpes boolean NOT NULL DEFAULT false,
  historico_queloide boolean NOT NULL DEFAULT false,
  doencas_cronicas text,
  fumante boolean NOT NULL DEFAULT false,
  contraindicacoes text,
  observacoes_clinicas text,
  preenchida_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.anamneses TO authenticated;
GRANT ALL ON public.anamneses TO service_role;

ALTER TABLE public.anamneses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read anamneses" ON public.anamneses FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert anamneses" ON public.anamneses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update anamneses" ON public.anamneses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin delete anamneses" ON public.anamneses FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_anamneses_updated_at BEFORE UPDATE ON public.anamneses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FOTOS PACIENTE
CREATE TABLE public.fotos_paciente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  agendamento_id uuid REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  procedimento_id uuid REFERENCES public.procedimentos(id) ON DELETE SET NULL,
  categoria public.foto_categoria NOT NULL,
  angulo public.foto_angulo NOT NULL DEFAULT 'frontal',
  storage_path text NOT NULL,
  data_foto timestamptz NOT NULL DEFAULT now(),
  consentimento_uso boolean NOT NULL DEFAULT false,
  observacao text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fotos_paciente_paciente ON public.fotos_paciente(paciente_id, data_foto DESC);

GRANT SELECT, INSERT, UPDATE ON public.fotos_paciente TO authenticated;
GRANT ALL ON public.fotos_paciente TO service_role;

ALTER TABLE public.fotos_paciente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read fotos" ON public.fotos_paciente FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert fotos" ON public.fotos_paciente FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update fotos" ON public.fotos_paciente FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin delete fotos" ON public.fotos_paciente FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Trigger: bloqueia upload sem consentimento
CREATE OR REPLACE FUNCTION public.fotos_paciente_check_consent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_lgpd boolean;
  c_img boolean;
BEGIN
  SELECT consentimento_lgpd, consentimento_imagem
    INTO c_lgpd, c_img
    FROM public.pacientes WHERE id = NEW.paciente_id;
  IF NOT COALESCE(c_lgpd,false) THEN
    RAISE EXCEPTION 'Paciente sem consentimento LGPD: upload bloqueado';
  END IF;
  IF NEW.consentimento_uso AND NOT COALESCE(c_img,false) THEN
    RAISE EXCEPTION 'Paciente sem consentimento de imagem: marca\xc3\xa7\xc3\xa3o de divulga\xc3\xa7\xc3\xa3o bloqueada';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fotos_paciente_consent
  BEFORE INSERT OR UPDATE ON public.fotos_paciente
  FOR EACH ROW EXECUTE FUNCTION public.fotos_paciente_check_consent();

-- Storage policies (bucket criado via tool)
CREATE POLICY "auth read fotos-pacientes"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fotos-pacientes');

CREATE POLICY "auth insert fotos-pacientes"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fotos-pacientes');

CREATE POLICY "auth update fotos-pacientes"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'fotos-pacientes');

CREATE POLICY "admin delete fotos-pacientes"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'fotos-pacientes' AND public.has_role(auth.uid(),'admin'));
