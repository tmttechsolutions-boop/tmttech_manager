-- TABELA PARA MENSAGENS AGENDADAS (DELAYS)
CREATE TABLE IF NOT EXISTS public.delayed_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES public.automation_rules(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL, -- ID do nó no React Flow de onde a sequência deve continuar
    content TEXT, -- Texto da mensagem (se for um disparo direto após o delay)
    scheduled_for TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, sent, error, cancelled
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance do poller
CREATE INDEX IF NOT EXISTS idx_delayed_messages_status_date ON public.delayed_messages (status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_delayed_messages_lead ON public.delayed_messages (lead_id);

-- Ativar RLS (Básico)
ALTER TABLE public.delayed_messages ENABLE ROW LEVEL SECURITY;

-- Política para permitir que o sistema (service_role) faça tudo e o anon apenas leitura se necessário
CREATE POLICY "System Full Access" ON public.delayed_messages
    FOR ALL USING (true);
