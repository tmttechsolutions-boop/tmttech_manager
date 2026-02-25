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

        // 3. Tenta um fetch real na Evolution API para ver o erro cru
        const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
        const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

        let evolutionTest = {};
        if (empresas && empresas.length > 0) {
            const inst = empresas[0].whatsapp_instance || `tmttech_${empresas[0].id}`;
            const testUrl = `${EVOLUTION_API_URL}/instance/connectionState/${inst}`;

            try {
                const res = await fetch(testUrl, {
                    headers: { 'apikey': EVOLUTION_API_KEY }
                });
                evolutionTest = {
                    status: res.status,
                    statusText: res.statusText,
                    url_tentada: testUrl,
                    body: await res.json().catch(() => "Nao é JSON")
                };
            } catch (e) {
                evolutionTest = { error: e.message, url_tentada: testUrl };
            }
        }

        return NextResponse.json({
            empresas,
            columns,
            evolutionTest,
            env_debug: {
                has_url: !!EVOLUTION_API_URL,
                has_key: !!EVOLUTION_API_KEY,
                url_base: EVOLUTION_API_URL
            }
        });
    } catch (err) {
        return NextResponse.json({ error: err.message });
    }
}
