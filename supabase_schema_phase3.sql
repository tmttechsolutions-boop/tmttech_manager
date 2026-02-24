-- Rode este código no SQL Editor do seu painel do Supabase para a Fase 3

-- Cria a tabela de Regras de Automação (O seu Mini-ManyChat)
CREATE TABLE automation_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  trigger_type text NOT NULL, -- Ex: 'agendamento', 'novo_lead'
  offset_minutes integer NOT NULL, -- Ex: -120 (2 horas antes), 1440 (1 dia depois)
  message_template text NOT NULL, -- Ex: 'Olá {{nome}}, seu horário é as {{hora}}'
  is_active boolean DEFAULT true
);

-- Cria a tabela de Logs de Mensagens (Para sabermos quem já recebeu o quê)
CREATE TABLE message_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  rule_id uuid REFERENCES automation_rules(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  agendamento_id uuid REFERENCES agendamentos(id) ON DELETE CASCADE,
  status text DEFAULT 'enviado'::text,
  error_message text
);

-- Ativa políticas de segurança (RLS - Permite acesso total temporário)
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acesso total temporário rules" ON automation_rules FOR ALL USING (true);
CREATE POLICY "Permitir acesso total temporário logs" ON message_logs FOR ALL USING (true);
