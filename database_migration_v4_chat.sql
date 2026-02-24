-- MIGRATION: Fase 9 (Omnichannel Live Chat)
-- Este script cria a tabela para persistir o histórico de conversas do WhatsApp.

-- 1. Criação da tabela de mensagens
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')), -- inbound: cliente mando, outbound: robô/humano mandou
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text', -- text, image, document, etc
    media_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar Realtime para esta tabela
-- Isso permite que o chat atualize instantaneamente na tela do usuário
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS chat_messages_lead_id_idx ON public.chat_messages(lead_id);
CREATE INDEX IF NOT EXISTS chat_messages_empresa_id_idx ON public.chat_messages(empresa_id);

-- 4. RLS (Row Level Security) - Segurança Multi-tenant
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresas só veem suas próprias mensagens"
    ON public.chat_messages
    FOR ALL
    USING (empresa_id IN (SELECT id FROM public.empresas WHERE auth_user_id = auth.uid()));

COMMENT ON TABLE public.chat_messages IS 'Armazena o histórico completo de conversas (Omnichannel) por empresa e lead.';
