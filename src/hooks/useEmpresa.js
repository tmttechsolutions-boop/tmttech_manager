import { useState, useEffect } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

export function useEmpresa() {
    const [empresaId, setEmpresaId] = useState(null);
    const [loadingEmpresa, setLoadingEmpresa] = useState(true);
    const supabase = createBrowserSupabaseClient();

    useEffect(() => {
        async function fetchEmpresa() {
            try {
                // 1. Pega o usuário logado atualmente (da sessão segura via Cookie)
                const { data: { user }, error: authError } = await supabase.auth.getUser();

                if (authError || !user) {
                    setLoadingEmpresa(false);
                    return;
                }

                // 2. Busca a empresa atrelada a esse usuário
                const { data: empresaData, error: empresaError } = await supabase
                    .from('empresas')
                    .select('id')
                    .eq('auth_user_id', user.id)
                    .single();

                if (empresaData) {
                    setEmpresaId(empresaData.id);
                } else {
                    console.error("Nenhuma empresa encontrada para este usuário.");
                }
            } catch (err) {
                console.error("Erro ao buscar empresa:", err);
            } finally {
                setLoadingEmpresa(false);
            }
        }

        fetchEmpresa();
    }, [supabase]);

    return { empresaId, loadingEmpresa };
}
