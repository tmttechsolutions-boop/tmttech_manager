import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function GET(req) {
    const ver = "5.1-final-debug-" + Date.now();

    const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
    const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
    const keyClean = EVOLUTION_API_KEY?.trim() || '';

    let debug = {
        version: ver,
        env: {
            url: EVOLUTION_API_URL,
            key_set: !!EVOLUTION_API_KEY
        },
        tests: {}
    };

    // 1. Google Test
    try {
        const gRes = await fetch('https://www.google.com', { method: 'HEAD' });
        debug.tests.google = gRes.status;
    } catch (e) {
        debug.tests.google = 'Error: ' + e.message;
    }

    // 2. Evolution GET Test
    if (EVOLUTION_API_URL) {
        try {
            const res = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
                headers: {
                    'apikey': keyClean,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            debug.tests.evo_get_status = res.status;
            const text = await res.text();
            debug.tests.evo_get_preview = text.substring(0, 50);
        } catch (e) {
            debug.tests.evo_get_error = e.message;
        }

        // 3. Evolution POST Test
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
                    text: "DEBUG: Teste v5.1"
                })
            });
            debug.tests.evo_post_status = pRes.status;
            const pText = await pRes.text();
            debug.tests.evo_post_preview = pText.substring(0, 50);
        } catch (e) {
            debug.tests.evo_post_error = e.message;
        }
    }

    return NextResponse.json(debug);
}
