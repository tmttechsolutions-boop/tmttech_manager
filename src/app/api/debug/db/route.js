import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function GET() {
    try {
        const supabase = createSupabaseClient();

        // 1. Lista empresas
        const { data: empresas, error: empError } = await supabase
            .from('empresas')
            .select('*');

        const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
        const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

        // Teste de conexão Global (Listar Instâncias)
        let globalTest = {};
        if (EVOLUTION_API_URL && EVOLUTION_API_KEY) {
            try {
                const res = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
                    headers: { 'apikey': EVOLUTION_API_KEY }
                });
                globalTest = {
                    status: res.status,
                    ok: res.ok,
                    body: await res.json().catch(() => "Not JSON")
                };
            } catch (e) {
                globalTest = { error: e.message };
            }
        }

        return NextResponse.json({
            debug_v: '1.4-auth-check',
            empresas_count: empresas?.length || 0,
            env: {
                has_url: !!EVOLUTION_API_URL,
                url: EVOLUTION_API_URL,
                key_fragment: EVOLUTION_API_KEY ? `${EVOLUTION_API_KEY.slice(0, 5)}...${EVOLUTION_API_KEY.slice(-5)}` : 'MISSING'
            },
            globalTest,
            db_error: empError?.message || null
        });
    } catch (err) {
        return NextResponse.json({ error: err.message });
    }
}
