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

        // Teste de conexão Global com TODOS os headers e métodos possíveis
        let authTests = {};
        if (EVOLUTION_API_URL && EVOLUTION_API_KEY) {
            const tests = [
                { name: 'Header: apikey', fetch: () => fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, { headers: { 'apikey': EVOLUTION_API_KEY.trim() } }) },
                { name: 'Header: x-api-key', fetch: () => fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, { headers: { 'x-api-key': EVOLUTION_API_KEY.trim() } }) },
                { name: 'Query Param: ?apikey=...', fetch: () => fetch(`${EVOLUTION_API_URL}/instance/fetchInstances?apikey=${EVOLUTION_API_KEY.trim()}`) },
                { name: 'Header: apiKey (CamelCase)', fetch: () => fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, { headers: { 'apiKey': EVOLUTION_API_KEY.trim() } }) }
            ];

            for (const test of tests) {
                try {
                    const res = await test.fetch();
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
            debug_v: '1.7-mega-auth-test',
            env_vars: {
                EVOLUTION_API_URL,
                key_length: EVOLUTION_API_KEY?.trim().length,
                key_fragment: EVOLUTION_API_KEY ? `${EVOLUTION_API_KEY.trim().slice(0, 5)}...${EVOLUTION_API_KEY.trim().slice(-5)}` : 'MISSING'
            },
            instanceMapping,
            authTests,
            db_error: empError?.message || null
        });
    } catch (err) {
        return NextResponse.json({ error: err.message });
    }
}
