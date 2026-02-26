import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function GET() {
    try {
        const supabase = createSupabaseClient();

        // 1. Pega uma empresa válida para teste
        const { data: companies } = await supabase.from('empresas').select('id').limit(1);
        const testEmpresaId = companies?.[0]?.id;

        // 2. Pega um lead válido para teste
        const { data: leads } = await supabase.from('leads').select('id').limit(1);
        const testLeadId = leads?.[0]?.id;

        // 3. Tenta inserir e CAPTURAR ERRO
        let insertStatus = "not_attempted";
        if (testEmpresaId && testLeadId) {
            const { error } = await supabase.from('chat_messages').insert([{
                empresa_id: testEmpresaId,
                lead_id: testLeadId,
                direction: 'inbound',
                content: 'Teste de debug schema',
                message_type: 'text'
            }]);

            if (error) {
                insertStatus = `ERROR: ${error.code} - ${error.message} (${error.details})`;
            } else {
                insertStatus = "SUCCESS";
            }
        } else {
            insertStatus = "ABORTED: missing company or lead for test";
        }

        // 4. Lista as colunas detectáveis (via tentativa de select *)
        const { data: columnsData, error: columnsError } = await supabase
            .from('chat_messages')
            .select('*')
            .limit(1);

        return NextResponse.json({
            debug_v: '2.6-schema-audit',
            insertStatus,
            columnsError: columnsError?.message || null,
            hasData: (columnsData?.length || 0) > 0,
            testContext: { testEmpresaId, testLeadId }
        });
    } catch (err) {
        return NextResponse.json({ error: err.message });
    }
}
