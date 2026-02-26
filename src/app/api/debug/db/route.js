import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function GET() {
    try {
        const supabase = createSupabaseClient();

        // 1. Lista empresas
        const { data: empresas, error: empError } = await supabase
            .from('empresas')
            .select('*');

        // 2. Busca últimos logs de mensagens
        const { data: recentLogs } = await supabase
            .from('message_logs')
            .order('created_at', { ascending: false })
            .limit(10);

        const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
        const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

        const keyClean = EVOLUTION_API_KEY?.trim() || '';
        const keyMetadata = {
            raw_length: EVOLUTION_API_KEY?.length || 0,
            trimmed_length: keyClean.length,
            hyphen_count: (keyClean.match(/-/g) || []).length,
            starts_with_letter: /^[a-zA-Z]/.test(keyClean),
            ends_with_alphanum: /[a-zA-Z0-9]$/.test(keyClean),
            fragment_reveal: keyClean.length > 20
                ? `${keyClean.slice(0, 8)}...${keyClean.slice(-8)}`
                : 'TOO_SHORT_TO_REVEAL'
        };

        // Teste de conexão Global com TODOS os headers e métodos possíveis
        let authTests = {};
        if (EVOLUTION_API_URL && keyClean) {
            const tests = [
                { name: 'Header: apikey', fetch: () => fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, { headers: { 'apikey': keyClean } }) },
                { name: 'Header: x-api-key', fetch: () => fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, { headers: { 'x-api-key': keyClean } }) },
                { name: 'Header: Authorization (Bearer)', fetch: () => fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, { headers: { 'Authorization': `Bearer ${keyClean}` } }) },
                { name: 'Query Param: ?apikey=...', fetch: () => fetch(`${EVOLUTION_API_URL}/instance/fetchInstances?apikey=${keyClean}`) },
                { name: 'Header: apiKey (CamelCase)', fetch: () => fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, { headers: { 'apiKey': keyClean } }) }
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

        return NextResponse.json({
            debug_v: '2.0-key-deep-dive',
            status: (Object.values(authTests).some(t => t.ok)) ? 'CONNECTED' : 'AUTH_FAILURE',
            env_vars: {
                EVOLUTION_API_URL,
                keyMetadata
            },
            instanceMapping: empresas?.map(e => ({
                empresa: e.nome,
                whatsapp_instance: e.whatsapp_instance || `tmttech_${e.id}`
            })) || [],
            recentLogs,
            authTests,
            db_error: empError?.message || null
        });
    } catch (err) {
        return NextResponse.json({ error: err.message });
    }
}
