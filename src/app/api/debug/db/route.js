import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function GET() {
    try {
        const supabase = createSupabaseClient(true); // Admin mode para teste

        // 1. Pega uma empresa válida para teste
        const { data: companies } = await supabase.from('empresas').select('id').limit(1);
        const testEmpresaId = companies?.[0]?.id;

        // 2. Pega um lead válido para teste
        const { data: leads } = await supabase.from('leads').select('id').limit(1);
        const testLeadId = leads?.[0]?.id;

        // 3. Tenta inserir e CAPTURAR ERRO com ADMIN = TRUE
        let adminInsertStatus = "not_attempted";
        if (testEmpresaId && testLeadId) {
            const { error } = await supabase.from('chat_messages').insert([{
                empresa_id: testEmpresaId,
                lead_id: testLeadId,
                direction: 'inbound',
                content: 'Teste de debug ADMIN RLS Bypass',
                message_type: 'text'
            }]);

            if (error) {
                adminInsertStatus = `ERROR: ${error.code} - ${error.message}`;
            } else {
                adminInsertStatus = "SUCCESS";
            }
        }

        // 4. Lista as mensagens (deve vir o teste acima se deu sucesso)
        const { data: messages } = await supabase
            .from('chat_messages')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        return NextResponse.json({
            debug_v: '2.7-admin-fix-test',
            adminInsertStatus,
            messages
        });
    } catch (err) {
        return NextResponse.json({ error: err.message });
    }
}
