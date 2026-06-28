export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agendamentos: {
        Row: {
          aguardando_confirmacao: boolean
          confirmacao_respondida_em: string | null
          confirmacao_resposta: string | null
          created_at: string
          data_hora: string
          duracao_minutos: number
          id: string
          lembrete_enviado: boolean
          observacoes: string | null
          paciente_id: string
          procedimento_id: string | null
          profissional: string | null
          status: Database["public"]["Enums"]["agendamento_status"]
          tipo: Database["public"]["Enums"]["agendamento_tipo"]
          updated_at: string
          valor: number | null
        }
        Insert: {
          aguardando_confirmacao?: boolean
          confirmacao_respondida_em?: string | null
          confirmacao_resposta?: string | null
          created_at?: string
          data_hora: string
          duracao_minutos?: number
          id?: string
          lembrete_enviado?: boolean
          observacoes?: string | null
          paciente_id: string
          procedimento_id?: string | null
          profissional?: string | null
          status?: Database["public"]["Enums"]["agendamento_status"]
          tipo: Database["public"]["Enums"]["agendamento_tipo"]
          updated_at?: string
          valor?: number | null
        }
        Update: {
          aguardando_confirmacao?: boolean
          confirmacao_respondida_em?: string | null
          confirmacao_resposta?: string | null
          created_at?: string
          data_hora?: string
          duracao_minutos?: number
          id?: string
          lembrete_enviado?: boolean
          observacoes?: string | null
          paciente_id?: string
          procedimento_id?: string | null
          profissional?: string | null
          status?: Database["public"]["Enums"]["agendamento_status"]
          tipo?: Database["public"]["Enums"]["agendamento_tipo"]
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_procedimento_id_fkey"
            columns: ["procedimento_id"]
            isOneToOne: false
            referencedRelation: "procedimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      anamneses: {
        Row: {
          alergias: string | null
          contraindicacoes: string | null
          created_at: string
          doencas_cronicas: string | null
          expectativas: string | null
          fumante: boolean
          gestante_lactante: boolean
          historico_herpes: boolean
          historico_queloide: boolean
          id: string
          observacoes_clinicas: string | null
          paciente_id: string
          preenchida_por: string | null
          procedimentos_anteriores: string | null
          queixa_principal: string | null
          updated_at: string
          usa_anticoagulante: boolean
          uso_medicamentos: string | null
        }
        Insert: {
          alergias?: string | null
          contraindicacoes?: string | null
          created_at?: string
          doencas_cronicas?: string | null
          expectativas?: string | null
          fumante?: boolean
          gestante_lactante?: boolean
          historico_herpes?: boolean
          historico_queloide?: boolean
          id?: string
          observacoes_clinicas?: string | null
          paciente_id: string
          preenchida_por?: string | null
          procedimentos_anteriores?: string | null
          queixa_principal?: string | null
          updated_at?: string
          usa_anticoagulante?: boolean
          uso_medicamentos?: string | null
        }
        Update: {
          alergias?: string | null
          contraindicacoes?: string | null
          created_at?: string
          doencas_cronicas?: string | null
          expectativas?: string | null
          fumante?: boolean
          gestante_lactante?: boolean
          historico_herpes?: boolean
          historico_queloide?: boolean
          id?: string
          observacoes_clinicas?: string | null
          paciente_id?: string
          preenchida_por?: string | null
          procedimentos_anteriores?: string | null
          queixa_principal?: string | null
          updated_at?: string
          usa_anticoagulante?: boolean
          uso_medicamentos?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anamneses_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: true
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      automacao_eventos: {
        Row: {
          created_at: string
          id: string
          ocorreu_em: string
          paciente_id: string
          payload: Json
          ref_id: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          id?: string
          ocorreu_em?: string
          paciente_id: string
          payload?: Json
          ref_id?: string | null
          tipo: string
        }
        Update: {
          created_at?: string
          id?: string
          ocorreu_em?: string
          paciente_id?: string
          payload?: Json
          ref_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "automacao_eventos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_user_id: string | null
          created_at: string
          id: string
          oportunidade_id: string | null
          paciente_id: string | null
          status: Database["public"]["Enums"]["conversation_status"]
          telefone: string
          ultima_mensagem_em: string | null
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          created_at?: string
          id?: string
          oportunidade_id?: string | null
          paciente_id?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          telefone: string
          ultima_mensagem_em?: string | null
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          created_at?: string
          id?: string
          oportunidade_id?: string | null
          paciente_id?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          telefone?: string
          ultima_mensagem_em?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "oportunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      fotos_paciente: {
        Row: {
          agendamento_id: string | null
          angulo: Database["public"]["Enums"]["foto_angulo"]
          categoria: Database["public"]["Enums"]["foto_categoria"]
          consentimento_uso: boolean
          created_at: string
          created_by: string | null
          data_foto: string
          id: string
          observacao: string | null
          paciente_id: string
          procedimento_id: string | null
          storage_path: string
        }
        Insert: {
          agendamento_id?: string | null
          angulo?: Database["public"]["Enums"]["foto_angulo"]
          categoria: Database["public"]["Enums"]["foto_categoria"]
          consentimento_uso?: boolean
          created_at?: string
          created_by?: string | null
          data_foto?: string
          id?: string
          observacao?: string | null
          paciente_id: string
          procedimento_id?: string | null
          storage_path: string
        }
        Update: {
          agendamento_id?: string | null
          angulo?: Database["public"]["Enums"]["foto_angulo"]
          categoria?: Database["public"]["Enums"]["foto_categoria"]
          consentimento_uso?: boolean
          created_at?: string
          created_by?: string | null
          data_foto?: string
          id?: string
          observacao?: string | null
          paciente_id?: string
          procedimento_id?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "fotos_paciente_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fotos_paciente_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fotos_paciente_procedimento_id_fkey"
            columns: ["procedimento_id"]
            isOneToOne: false
            referencedRelation: "procedimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens_agendadas: {
        Row: {
          agendado_para: string
          agendamento_id: string | null
          conteudo_renderizado: string
          conversation_id: string | null
          created_at: string
          created_by: string | null
          enviada_em: string | null
          erro: string | null
          id: string
          modelo_id: string | null
          origem: Database["public"]["Enums"]["msg_origem"]
          paciente_id: string
          status: Database["public"]["Enums"]["msg_status"]
          tentativas: number
          tipo: Database["public"]["Enums"]["modelo_tipo"]
          updated_at: string
          variaveis: Json
        }
        Insert: {
          agendado_para: string
          agendamento_id?: string | null
          conteudo_renderizado?: string
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          enviada_em?: string | null
          erro?: string | null
          id?: string
          modelo_id?: string | null
          origem?: Database["public"]["Enums"]["msg_origem"]
          paciente_id: string
          status?: Database["public"]["Enums"]["msg_status"]
          tentativas?: number
          tipo?: Database["public"]["Enums"]["modelo_tipo"]
          updated_at?: string
          variaveis?: Json
        }
        Update: {
          agendado_para?: string
          agendamento_id?: string | null
          conteudo_renderizado?: string
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          enviada_em?: string | null
          erro?: string | null
          id?: string
          modelo_id?: string | null
          origem?: Database["public"]["Enums"]["msg_origem"]
          paciente_id?: string
          status?: Database["public"]["Enums"]["msg_status"]
          tentativas?: number
          tipo?: Database["public"]["Enums"]["modelo_tipo"]
          updated_at?: string
          variaveis?: Json
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_agendadas_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_agendadas_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_agendadas_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos_mensagem"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_agendadas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content_text: string | null
          conversation_id: string
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          external_message_id: string | null
          id: string
          media_mime_type: string | null
          media_url: string | null
          sent_at: string | null
          status: string | null
          type: Database["public"]["Enums"]["message_type"]
        }
        Insert: {
          content_text?: string | null
          conversation_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["message_direction"]
          external_message_id?: string | null
          id?: string
          media_mime_type?: string | null
          media_url?: string | null
          sent_at?: string | null
          status?: string | null
          type?: Database["public"]["Enums"]["message_type"]
        }
        Update: {
          content_text?: string | null
          conversation_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          external_message_id?: string | null
          id?: string
          media_mime_type?: string | null
          media_url?: string | null
          sent_at?: string | null
          status?: string | null
          type?: Database["public"]["Enums"]["message_type"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      modelos_mensagem: {
        Row: {
          ativo: boolean
          corpo: string
          created_at: string
          id: string
          nome: string
          tipo: Database["public"]["Enums"]["modelo_tipo"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          corpo?: string
          created_at?: string
          id?: string
          nome: string
          tipo: Database["public"]["Enums"]["modelo_tipo"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          corpo?: string
          created_at?: string
          id?: string
          nome?: string
          tipo?: Database["public"]["Enums"]["modelo_tipo"]
          updated_at?: string
        }
        Relationships: []
      }
      oportunidades: {
        Row: {
          created_at: string
          etapa: Database["public"]["Enums"]["etapa_funil"]
          id: string
          motivo_perda: string | null
          notas: string | null
          paciente_id: string
          procedimento_interesse_id: string | null
          proximo_followup_em: string | null
          responsavel_interno_id: string | null
          status: Database["public"]["Enums"]["oportunidade_status"]
          temperatura: Database["public"]["Enums"]["temperatura_type"] | null
          updated_at: string
          valor_estimado: number | null
          valor_final: number | null
        }
        Insert: {
          created_at?: string
          etapa?: Database["public"]["Enums"]["etapa_funil"]
          id?: string
          motivo_perda?: string | null
          notas?: string | null
          paciente_id: string
          procedimento_interesse_id?: string | null
          proximo_followup_em?: string | null
          responsavel_interno_id?: string | null
          status?: Database["public"]["Enums"]["oportunidade_status"]
          temperatura?: Database["public"]["Enums"]["temperatura_type"] | null
          updated_at?: string
          valor_estimado?: number | null
          valor_final?: number | null
        }
        Update: {
          created_at?: string
          etapa?: Database["public"]["Enums"]["etapa_funil"]
          id?: string
          motivo_perda?: string | null
          notas?: string | null
          paciente_id?: string
          procedimento_interesse_id?: string | null
          proximo_followup_em?: string | null
          responsavel_interno_id?: string | null
          status?: Database["public"]["Enums"]["oportunidade_status"]
          temperatura?: Database["public"]["Enums"]["temperatura_type"] | null
          updated_at?: string
          valor_estimado?: number | null
          valor_final?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "oportunidades_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oportunidades_procedimento_interesse_id_fkey"
            columns: ["procedimento_interesse_id"]
            isOneToOne: false
            referencedRelation: "procedimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      pacientes: {
        Row: {
          aceita_automacoes: boolean
          consentimento_imagem: boolean
          consentimento_lgpd: boolean
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          email: string | null
          endereco: string | null
          foto_url: string | null
          id: string
          nome: string
          observacoes: string | null
          origem: Database["public"]["Enums"]["origem_type"] | null
          sexo: string | null
          tags: string[]
          telefone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          aceita_automacoes?: boolean
          consentimento_imagem?: boolean
          consentimento_lgpd?: boolean
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          foto_url?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["origem_type"] | null
          sexo?: string | null
          tags?: string[]
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          aceita_automacoes?: boolean
          consentimento_imagem?: boolean
          consentimento_lgpd?: boolean
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["origem_type"] | null
          sexo?: string | null
          tags?: string[]
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      procedimentos: {
        Row: {
          ativo: boolean
          categoria: string | null
          created_at: string
          descricao: string | null
          duracao_minutos: number | null
          id: string
          nome: string
          recorrencia_dias: number | null
          retorno_dias: number | null
          updated_at: string
          valor_padrao: number | null
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          duracao_minutos?: number | null
          id?: string
          nome: string
          recorrencia_dias?: number | null
          retorno_dias?: number | null
          updated_at?: string
          valor_padrao?: number | null
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          duracao_minutos?: number | null
          id?: string
          nome?: string
          recorrencia_dias?: number | null
          retorno_dias?: number | null
          updated_at?: string
          valor_padrao?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          chave: string
          created_at: string
          id: string
          updated_at: string
          valor: Json
        }
        Insert: {
          chave: string
          created_at?: string
          id?: string
          updated_at?: string
          valor: Json
        }
        Update: {
          chave?: string
          created_at?: string
          id?: string
          updated_at?: string
          valor?: Json
        }
        Relationships: []
      }
      tasks: {
        Row: {
          agendamento_id: string | null
          completed_at: string | null
          created_at: string
          descricao: string | null
          due_date: string | null
          id: string
          oportunidade_id: string | null
          paciente_id: string | null
          prioridade: Database["public"]["Enums"]["task_priority"]
          responsavel_interno_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          titulo: string
          updated_at: string
        }
        Insert: {
          agendamento_id?: string | null
          completed_at?: string | null
          created_at?: string
          descricao?: string | null
          due_date?: string | null
          id?: string
          oportunidade_id?: string | null
          paciente_id?: string | null
          prioridade?: Database["public"]["Enums"]["task_priority"]
          responsavel_interno_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          titulo: string
          updated_at?: string
        }
        Update: {
          agendamento_id?: string | null
          completed_at?: string | null
          created_at?: string
          descricao?: string | null
          due_date?: string | null
          id?: string
          oportunidade_id?: string | null
          paciente_id?: string | null
          prioridade?: Database["public"]["Enums"]["task_priority"]
          responsavel_interno_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "oportunidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_type: string | null
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          source: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type?: string | null
          id?: string
          payload: Json
          processed?: boolean
          processed_at?: string | null
          source: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string | null
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          source?: string
        }
        Relationships: []
      }
      zapi_instances: {
        Row: {
          client_token: string | null
          connected: boolean
          created_at: string
          id: string
          instance_id: string
          nome_instancia: string
          phone_number: string | null
          status: string | null
          token: string
          updated_at: string
        }
        Insert: {
          client_token?: string | null
          connected?: boolean
          created_at?: string
          id?: string
          instance_id: string
          nome_instancia: string
          phone_number?: string | null
          status?: string | null
          token: string
          updated_at?: string
        }
        Update: {
          client_token?: string | null
          connected?: boolean
          created_at?: string
          id?: string
          instance_id?: string
          nome_instancia?: string
          phone_number?: string | null
          status?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      enfileirar_automacao: {
        Args: {
          _agendado_para: string
          _agendamento_id?: string
          _idemp_key?: string
          _idemp_ref?: string
          _paciente_id: string
          _tipo: Database["public"]["Enums"]["modelo_tipo"]
          _vars_extra?: Json
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      render_template: {
        Args: { template: string; vars: Json }
        Returns: string
      }
      run_regua_aniversario: { Args: never; Returns: number }
      run_regua_reativacao: { Args: never; Returns: number }
    }
    Enums: {
      agendamento_status:
        | "agendado"
        | "confirmado"
        | "realizado"
        | "faltou"
        | "cancelado"
      agendamento_tipo: "avaliacao" | "procedimento" | "retorno"
      app_role: "admin" | "atendente"
      conversation_status:
        | "nao_lida"
        | "em_atendimento"
        | "aguardando"
        | "resolvida"
        | "arquivada"
      etapa_funil:
        | "novo_lead"
        | "primeiro_contato"
        | "avaliacao_agendada"
        | "avaliacao_realizada"
        | "orcamento_enviado"
        | "negociacao"
        | "procedimento_agendado"
        | "cliente"
        | "pos_procedimento"
        | "perdido"
      foto_angulo: "frontal" | "perfil_direito" | "perfil_esquerdo" | "outro"
      foto_categoria: "antes" | "depois" | "evolucao"
      message_direction: "inbound" | "outbound"
      message_type: "text" | "image" | "audio" | "video" | "document"
      modelo_tipo:
        | "boas_vindas"
        | "confirmacao"
        | "lembrete"
        | "pos_procedimento"
        | "retorno"
        | "recall"
        | "aniversario"
        | "reativacao"
        | "no_show"
        | "manual"
      msg_origem: "automacao" | "manual"
      msg_status: "pendente" | "enviada" | "cancelada" | "falhou" | "respondida"
      oportunidade_status: "aberta" | "ganha" | "perdida"
      origem_type:
        | "instagram"
        | "indicacao"
        | "google"
        | "tiktok"
        | "site"
        | "anuncio_meta"
        | "whatsapp"
        | "passou_em_frente"
        | "outro"
      task_priority: "baixa" | "media" | "alta" | "urgente"
      task_status: "pendente" | "em_andamento" | "concluida" | "cancelada"
      temperatura_type: "quente" | "morno" | "frio"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agendamento_status: [
        "agendado",
        "confirmado",
        "realizado",
        "faltou",
        "cancelado",
      ],
      agendamento_tipo: ["avaliacao", "procedimento", "retorno"],
      app_role: ["admin", "atendente"],
      conversation_status: [
        "nao_lida",
        "em_atendimento",
        "aguardando",
        "resolvida",
        "arquivada",
      ],
      etapa_funil: [
        "novo_lead",
        "primeiro_contato",
        "avaliacao_agendada",
        "avaliacao_realizada",
        "orcamento_enviado",
        "negociacao",
        "procedimento_agendado",
        "cliente",
        "pos_procedimento",
        "perdido",
      ],
      foto_angulo: ["frontal", "perfil_direito", "perfil_esquerdo", "outro"],
      foto_categoria: ["antes", "depois", "evolucao"],
      message_direction: ["inbound", "outbound"],
      message_type: ["text", "image", "audio", "video", "document"],
      modelo_tipo: [
        "boas_vindas",
        "confirmacao",
        "lembrete",
        "pos_procedimento",
        "retorno",
        "recall",
        "aniversario",
        "reativacao",
        "no_show",
        "manual",
      ],
      msg_origem: ["automacao", "manual"],
      msg_status: ["pendente", "enviada", "cancelada", "falhou", "respondida"],
      oportunidade_status: ["aberta", "ganha", "perdida"],
      origem_type: [
        "instagram",
        "indicacao",
        "google",
        "tiktok",
        "site",
        "anuncio_meta",
        "whatsapp",
        "passou_em_frente",
        "outro",
      ],
      task_priority: ["baixa", "media", "alta", "urgente"],
      task_status: ["pendente", "em_andamento", "concluida", "cancelada"],
      temperatura_type: ["quente", "morno", "frio"],
    },
  },
} as const
