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
                    data_received: res.ok
                };
            } catch (e) {
                globalTest = { error: e.message };
            }
        }

        const instanceMapping = empresas?.map(e => ({
            empresa: e.nome,
            id: e.id,
            whatsapp_instance: e.whatsapp_instance,
            resolved_instance: e.whatsapp_instance || `tmttech_${e.id}`
        })) || [];

        return NextResponse.json({
            debug_v: '1.5-mapping-check',
            env_vars: {
                EVOLUTION_API_URL,
                key_fragment: EVOLUTION_API_KEY ? `${EVOLUTION_API_KEY.slice(0, 5)}...${EVOLUTION_API_KEY.slice(-5)}` : 'MISSING'
            },
            instanceMapping,
            globalTest,
            db_error: empError?.message || null
        });
    } catch (err) {
        return NextResponse.json({ error: err.message });
    }
}
