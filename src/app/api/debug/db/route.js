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

        const keyClean = EVOLUTION_API_KEY?.trim() || '';

        // Teste de conexão E MENSAGEM (Para ver o 400 Bad Request)
        let sendTest = { status: 'not_attempted' };
        if (EVOLUTION_API_URL && keyClean) {
            // Tentamos enviar para o número do dono da instância que vimos no debug anterior
            // 553788123971
            try {
                const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/tmttech_manager`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': keyClean
                    },
                    body: JSON.stringify({
                        number: "553788123971",
                        options: { delay: 1200, presence: 'composing' },
                        textMessage: { text: "Teste de Diagnóstico CRM" }
                    })
                });
                const body = await res.json().catch(() => ({ raw: 'no-json-body' }));
                sendTest = {
                    status: res.status,
                    ok: res.ok,
                    response: body,
                    payload_sent: {
                        number: "553788123971",
                        textMessage: { text: "Teste de Diagnóstico CRM" }
                    }
                };
            } catch (e) {
                sendTest = { error: e.message };
            }
        }

        return NextResponse.json({
            debug_v: '2.2-send-test',
            env_vars: {
                EVOLUTION_API_URL
            },
            sendTest,
            db_error: empError?.message || null
        });
    } catch (err) {
        return NextResponse.json({ error: err.message });
    }
}
