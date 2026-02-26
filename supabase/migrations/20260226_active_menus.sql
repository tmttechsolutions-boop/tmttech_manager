CREATE TABLE IF NOT EXISTS public.active_menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES public.automation_rules(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL, 
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(lead_id) -- Garante que um lead só tenha 1 menu ativo por vez
);

CREATE INDEX IF NOT EXISTS idx_active_menus_lead ON public.active_menus (lead_id);
ALTER TABLE public.active_menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.active_menus FOR ALL USING (true);
