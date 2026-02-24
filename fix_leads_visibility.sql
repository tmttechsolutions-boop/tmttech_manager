-- FIX: Segurança Multi-tenant e Visibilidade (Fase 9.2)
-- Este script habilita RLS e cria as políticas de segurança para que cada empresa veja apenas seus dados.

-- 1. Habilitar RLS nas tabelas principais
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas se existirem para evitar duplicados
DROP POLICY IF EXISTS "Empresas veem seus próprios leads" ON public.leads;
DROP POLICY IF EXISTS "Empresas veem seus próprios agendamentos" ON public.agendamentos;

-- 3. Criar Políticas de Segurança Baseadas no Usuário Logado
-- A lógica é: O usuário logado (auth.uid()) deve pertencer à empresa_id que ele está tentando ver.

CREATE POLICY "Empresas veem seus próprios leads"
ON public.leads
FOR ALL
USING (
    empresa_id IN (
        SELECT id FROM public.empresas WHERE auth_user_id = auth.uid()
    )
)
WITH CHECK (
    empresa_id IN (
        SELECT id FROM public.empresas WHERE auth_user_id = auth.uid()
    )
);

CREATE POLICY "Empresas veem seus próprios agendamentos"
ON public.agendamentos
FOR ALL
USING (
    empresa_id IN (
        SELECT id FROM public.empresas WHERE auth_user_id = auth.uid()
    )
)
WITH CHECK (
    empresa_id IN (
        SELECT id FROM public.empresas WHERE auth_user_id = auth.uid()
    )
);

-- 4. Backfill de Emergência: Caso existam leads sem empresa vinculada, vincula à primeira empresa do banco (Opcional)
-- UPDATE public.leads SET empresa_id = (SELECT id FROM public.empresas LIMIT 1) WHERE empresa_id IS NULL;

-- 5. Recarrega Cache
NOTIFY pgrst, 'reload schema';
