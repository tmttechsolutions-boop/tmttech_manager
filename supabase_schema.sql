-- Rode este código no SQL Editor do seu painel do Supabase

-- Cria a tabela de Leads (Pessoas)
CREATE TABLE leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  name text NOT NULL,
  phone text NOT NULL UNIQUE,
  status text DEFAULT 'novo'::text,
  source text DEFAULT 'manual'::text
);

-- Cria a tabela de Agendamentos (Eventos ligados a Leads)
CREATE TABLE agendamentos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  service text NOT NULL,
  date_time timestamp with time zone NOT NULL,
  status text DEFAULT 'confirmado'::text,
  reminder_sent boolean DEFAULT false
);

-- Ativa políticas de segurança (RLS - Permite ler e gravar publicamente para o MVP)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acesso total temporário leads" ON leads FOR ALL USING (true);
CREATE POLICY "Permitir acesso total temporário agendamentos" ON agendamentos FOR ALL USING (true);
