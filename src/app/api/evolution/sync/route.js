import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import { syncChatHistory } from '@/lib/evolution-sync';

export async function POST(req) {
    try {
        const { empresaId } = await req.json();
        const supabase = createSupabaseClient(true);

        // 1. Busca a instância configurada para esta empresa
        const { data: empresa } = await supabase
            .from('empresas')
            .select('whatsapp_instance')
            .eq('id', empresaId)
            .single();

        if (!empresa?.whatsapp_instance) {
            return NextResponse.json({ error: "Instância WhatsApp não configurada para esta empresa." }, { status: 400 });
        }

        // 2. Executa Sincronização
        const syncResults = await syncChatHistory(empresaId, empresa.whatsapp_instance);

        return NextResponse.json({
            message: "Sincronização concluída com sucesso!",
            details: syncResults
        });

    } catch (error) {
        console.error("[API SYNC ERROR]", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
