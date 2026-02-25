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
                    instance: inst,
                    body: await res.json().catch(() => "Not JSON")
                };
            } catch (e) {
                evolutionTest = { error: e.message };
            }
        }

        return NextResponse.json({
            debug_v: '1.3-stable',
            empresas,
            evolutionTest,
            env: {
                has_url: !!EVOLUTION_API_URL,
                has_key: !!EVOLUTION_API_KEY
            }
        });
    } catch (err) {
        return NextResponse.json({ error: err.message });
    }
}
