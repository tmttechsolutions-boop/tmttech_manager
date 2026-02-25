-- FIX: Recuperação de Conexão Legada (Fase 9.3)
-- Este script permite definir um nome de instância personalizado para cada empresa.

-- 1. Adiciona a coluna de instância personalizada se ela não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='empresas' AND column_name='whatsapp_instance') THEN
        ALTER TABLE public.empresas ADD COLUMN whatsapp_instance TEXT;
    END IF;
END $$;

-- 2. Tenta recuperar a conexão antiga para a sua empresa principal
-- Substitua 'tmt_manager' pelo nome da instância que aparece como CONECTADA no seu Evolution
UPDATE public.empresas 
SET whatsapp_instance = 'tmt_manager' 
WHERE id = (SELECT id FROM public.empresas ORDER BY created_at ASC LIMIT 1);

-- 3. Recarrega Cache
NOTIFY pgrst, 'reload schema';
