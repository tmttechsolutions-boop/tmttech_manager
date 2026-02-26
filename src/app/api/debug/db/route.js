import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function GET() {
    try {
        const supabase = createSupabaseClient(); // SEM ADMIN MODE - Teste simples RLS Disable

        // 1. Pega uma empresa válida para teste
        const { data: companies } = await supabase.from('empresas').select('id').limit(1);
        const testEmpresaId = companies?.[0]?.id;

        // 2. Pega um lead válido para teste
        const { data: leads } = await supabase.from('leads').select('id').limit(1);
        const testLeadId = leads?.[0]?.id;

        // 3. Tenta inserir e CAPTURAR ERRO (Sem admin mode)
        let simpleInsertStatus = "not_attempted";
        if (testEmpresaId && testLeadId) {
            const { error } = await supabase.from('chat_messages').insert([{
                empresa_id: testEmpresaId,
                lead_id: testLeadId,
                direction: 'inbound',
                content: 'Teste de debug APÓS RLS DISABLE',
                message_type: 'text'
            }]);

            if (error) {
                simpleInsertStatus = `ERROR: ${error.code} - ${error.message}`;
            } else {
                simpleInsertStatus = "SUCCESS";
            }
        }

        // 4. Lista as últimas 20 mensagens (Toda a história)
        const { data: allMessages } = await supabase
            .from('chat_messages')
            .select('*, leads(nome, telefone)')
            .order('created_at', { ascending: false })
            .limit(20);

        return NextResponse.json({
            debug_v: '2.9-rls-disable-test',
            simpleInsertStatus,
            messageCount: allMessages?.length || 0,
            allMessages
        });
    } catch (err) {
        return NextResponse.json({ error: err.message });
    }
}
