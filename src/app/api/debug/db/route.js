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

        // Teste de conexão Global com múltiplos headers
        let authTests = {};
        if (EVOLUTION_API_URL && EVOLUTION_API_KEY) {
            const testEndpoints = [
                { name: 'Header: apikey', headers: { 'apikey': EVOLUTION_API_KEY } },
                { name: 'Header: apiKey', headers: { 'apiKey': EVOLUTION_API_KEY } },
                { name: 'Header: Authorization', headers: { 'Authorization': `Bearer ${EVOLUTION_API_KEY}` } }
            ];

            for (const test of testEndpoints) {
                try {
                    const res = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
                        headers: test.headers
                    });
                    authTests[test.name] = {
                        status: res.status,
                        ok: res.ok
                    };
                } catch (e) {
                    authTests[test.name] = { error: e.message };
                }
            }
        }

        const instanceMapping = empresas?.map(e => ({
            empresa: e.nome,
            id: e.id,
            whatsapp_instance: e.whatsapp_instance,
            resolved_instance: e.whatsapp_instance || `tmttech_${e.id}`
        })) || [];

        return NextResponse.json({
            debug_v: '1.6-auth-multitest',
            env_vars: {
                EVOLUTION_API_URL,
                key_fragment: EVOLUTION_API_KEY ? `${EVOLUTION_API_KEY.slice(0, 5)}...${EVOLUTION_API_KEY.slice(-5)}` : 'MISSING'
            },
            instanceMapping,
            authTests,
            db_error: empError?.message || null
        });
    } catch (err) {
        return NextResponse.json({ error: err.message });
    }
}
