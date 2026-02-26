import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function POST(req) {
    try {
        const { leadId, empresaId } = await req.json();
        const supabase = createSupabaseClient(true);

        if (!leadId || !empresaId) {
            return NextResponse.json({ error: 'leadId and empresaId are required' }, { status: 400 });
        }

        // Limpa o log de automação clássico
        const { error } = await supabase
            .from('message_logs')
            .delete()
            .eq('lead_id', leadId)
            .eq('empresa_id', empresaId);

        // ESSENCIAL: Limpa também qualquer menu interativo travado para este lead
        await supabase
            .from('active_menus')
            .delete()
            .eq('lead_id', leadId)
            .eq('empresa_id', empresaId);

        if (error) throw error;

        return NextResponse.json({ success: true, message: 'Automação resetada com sucesso.' });
    } catch (error) {
        console.error('Error resetting automation:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
