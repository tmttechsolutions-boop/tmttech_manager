-- MIGRATION: Fase 8 (Gestor de Automações / Flow Manager)
-- Este script atualiza a tabela 'automation_rules' para suportar múltiplos fluxos visuais completos salvos pelo React Flow.

DO $$
BEGIN
    -- 1. Adiciona o nome personalizado do fluxo
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_rules' AND column_name='name') THEN
        ALTER TABLE public.automation_rules ADD COLUMN name TEXT DEFAULT 'Nova Automação';
    END IF;

    -- 2. Adiciona a descrição (opcional)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_rules' AND column_name='description') THEN
        ALTER TABLE public.automation_rules ADD COLUMN description TEXT;
    END IF;

    -- 3. Adiciona a coluna JSONB que vai armazenar a posição x/y e os dados das caixinhas visuais do React Flow
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_rules' AND column_name='flow_data') THEN
        ALTER TABLE public.automation_rules ADD COLUMN flow_data JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;
