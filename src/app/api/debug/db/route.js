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
            .select('*, automation_rules(name, trigger_type)')
            .order('created_at', { ascending: false })
            .limit(10);

        const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
        const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

        const keyClean = EVOLUTION_API_KEY?.trim() || '';
        const keyMetadata = {
            trimmed_length: keyClean.length,
            hyphen_count: (keyClean.match(/-/g) || []).length,
            fragment_reveal: keyClean.length > 20
                ? `${keyClean.slice(0, 8)}...${keyClean.slice(-8)}`
                : 'TOO_SHORT'
        };

        // Teste de conexão Global com TODOS os headers e métodos possíveis + Captura de Erro
        let authTests = {};
        if (EVOLUTION_API_URL && keyClean) {
            const tests = [
                { name: 'Header: apikey', fetch: () => fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, { headers: { 'apikey': keyClean } }) },
                { name: 'Header: x-api-key', fetch: () => fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, { headers: { 'x-api-key': keyClean } }) },
                { name: 'Header: Authorization (Bearer)', fetch: () => fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, { headers: { 'Authorization': `Bearer ${keyClean}` } }) }
            ];

            for (const test of tests) {
                try {
                    const res = await test.fetch();
                    const body = await res.json().catch(() => ({ raw: 'no-json-body' }));
                    authTests[test.name] = {
                        status: res.status,
                        ok: res.ok,
                        response: body
                    };
                } catch (e) {
                    authTests[test.name] = { error: e.message };
                }
            }
        }

        return NextResponse.json({
            debug_v: '2.1-body-capture',
            env_vars: {
                EVOLUTION_API_URL,
                keyMetadata
            },
            recentLogs,
            authTests,
            db_error: empError?.message || null
        });
    } catch (err) {
        return NextResponse.json({ error: err.message });
    }
}
