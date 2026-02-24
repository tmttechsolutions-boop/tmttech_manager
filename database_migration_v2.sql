-- MIGRATION: Fase 7 (Transformation SaaS / Multi-Tenant)
-- Esse script cria as tabelas de empresas e prepara o isolamento dos dados.

-- 1. Cria a Tabela Mestre 'empresas'
CREATE TABLE IF NOT EXISTS public.empresas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    documento TEXT,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Vincula ao usuário de login do Supabase
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Adiciona o Crachá 'empresa_id' nas tabelas filhas (Se já não existir)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='empresa_id') THEN
        ALTER TABLE public.leads ADD COLUMN empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agendamentos' AND column_name='empresa_id') THEN
        ALTER TABLE public.agendamentos ADD COLUMN empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_rules' AND column_name='empresa_id') THEN
        ALTER TABLE public.automation_rules ADD COLUMN empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='message_logs' AND column_name='empresa_id') THEN
        ALTER TABLE public.message_logs ADD COLUMN empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. (OPCIONAL/SEGURANÇA): Criar a 'Empresa Padrão' TMT Tech para os leads que já existem
-- Insere uma empresa mestre e associa todos os leads antigos a ela para nada sumir
DO $$
DECLARE
    default_emp_id UUID;
BEGIN
    -- Só cria se ainda não tiver empresa nenhuma
    IF NOT EXISTS (SELECT 1 FROM public.empresas) THEN
        INSERT INTO public.empresas (nome) VALUES ('Sua Primeira Barbearia (TMT)') RETURNING id INTO default_emp_id;
        
        -- Atualiza todos os leads antigos para pertencerem a esta empresa
        UPDATE public.leads SET empresa_id = default_emp_id WHERE empresa_id IS NULL;
        UPDATE public.agendamentos SET empresa_id = default_emp_id WHERE empresa_id IS NULL;
        UPDATE public.automation_rules SET empresa_id = default_emp_id WHERE empresa_id IS NULL;
        UPDATE public.message_logs SET empresa_id = default_emp_id WHERE empresa_id IS NULL;
    END IF;
END $$;
