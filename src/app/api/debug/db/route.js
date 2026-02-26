import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function GET() {
    try {
        const supabase = createSupabaseClient();
        const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
        const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
        const keyClean = EVOLUTION_API_KEY?.trim() || '';

        // Teste de conexão E MENSAGEM (Com o novo formato flat 'text')
        let sendTest = { status: 'not_attempted' };
        if (EVOLUTION_API_URL && keyClean) {
            try {
                const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/tmttech_manager`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': keyClean
                    },
                    body: JSON.stringify({
                        number: "553788123971",
                        text: "Teste de Diagnóstico CRM (Payload V2 Fix)"
                    })
                });
                const body = await res.json().catch(() => ({ raw: 'no-json-body' }));
                sendTest = {
                    status: res.status,
                    ok: res.ok,
                    response: body
                };
            } catch (e) {
                sendTest = { error: e.message };
            }
        }

        return NextResponse.json({
            debug_v: '2.3-payload-fix-test',
            sendTest
        });
    } catch (err) {
        return NextResponse.json({ error: err.message });
    }
}
