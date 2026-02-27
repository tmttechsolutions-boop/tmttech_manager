import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function GET(req) {
    const ts = Date.now();
    const ver = "5.0-ultra-debug-" + ts;

    const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
    const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
    const keyClean = EVOLUTION_API_KEY?.trim() || '';
    const targetUrl = `${EVOLUTION_API_URL}/instance/fetchInstances`;

    let debug = {
        version: ver,
        env: {
            url_set: !!EVOLUTION_API_URL,
            url_val: EVOLUTION_API_URL,
            url_exact: targetUrl,
            key_set: !!EVOLUTION_API_KEY
        },
        tests: {}
    };

    try {
        const gRes = await fetch('https://www.google.com', { method: 'HEAD' });
        debug.tests.google = gRes.status;
    } catch (e) {
        debug.tests.google = 'Error: ' + e.message;
    }

    if (EVOLUTION_API_URL) {
        try {
            const res = await fetch(targetUrl, {
                headers: {
                    'apikey': keyClean,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            debug.tests.evo_instances_status = res.status;
            const text = await res.text();
            debug.tests.evo_instances_preview = text.substring(0, 100);

            // TESTE EXTRA: POST real (Simulação de mensagem)
            try {
                const pRes = await fetch(`${EVOLUTION_API_URL}/message/sendText/tmttech_manager`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': keyClean,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    body: JSON.stringify({
                        number: "553788123971",
                        text: "DEBUG: Teste de conectividade POST"
                    })
                });
                debug.tests.evo_post_status = pRes.status;
                const pText = await pRes.text();
                debug.tests.evo_post_preview = pText.substring(0, 100);
            } catch (pErr) {
                debug.tests.evo_post_error = pErr.message;
            }
        } catch (e) {
            debug.tests.evo_instances_error = e.message;
        }
    }

    return NextResponse.json(debug);
}
