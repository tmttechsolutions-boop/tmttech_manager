-- FIX: Padronização de Colunas (Fase 9.1)
-- Este script garante que a coluna de nome do lead seja 'nome' (em português), resolvendo o erro de Cache de Schema.

DO $$
BEGIN
    -- 1. Se existir a coluna 'name', renomeia para 'nome'
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='name') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='nome') THEN
        ALTER TABLE public.leads RENAME COLUMN "name" TO "nome";
    END IF;

    -- 2. Se por algum motivo não tiver nem 'name' nem 'nome', cria 'nome'
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='nome') THEN
        ALTER TABLE public.leads ADD COLUMN nome TEXT;
    END IF;

    -- 3. Garante que a coluna 'telefone' exista (em vez de 'phone')
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='phone') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='telefone') THEN
        ALTER TABLE public.leads RENAME COLUMN "phone" TO "telefone";
    END IF;
END $$;

-- Recarrega o cache do PostgREST para o Supabase reconhecer as mudanças na hora
NOTIFY pgrst, 'reload schema';
