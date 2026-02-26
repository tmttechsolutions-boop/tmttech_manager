-- EXECUTE ESTE SQL NO EDITOR DO SUPABASE PARA ATIVAR OS ATRASOS
CREATE TABLE IF NOT EXISTS public.delayed_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES public.automation_rules(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL, 
    scheduled_for TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delayed_messages_status_date ON public.delayed_messages (status, scheduled_for);
ALTER TABLE public.delayed_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON public.delayed_messages FOR ALL USING (true);
