import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function GET() {
    try {
        const supabase = createSupabaseClient();

        // 1. Lista todas as empresas e suas instâncias configuradas
        const { data: empresas, error: empError } = await supabase
            .from('empresas')
            .select('id, nome, whatsapp_instance, auth_user_id');

        // 2. Verifica se a coluna whatsapp_instance existe mesmo
        const { data: columns } = await supabase.rpc('get_column_names', { table_name: 'empresas' });

        return NextResponse.json({
            empresas,
            columns,
            error: empError
        });
    } catch (err) {
        return NextResponse.json({ error: err.message });
    }
}
