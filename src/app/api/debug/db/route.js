import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function GET(req) {
    const ts = Date.now();
    const ver = "5.0-ultra-debug-" + ts;

    const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
    const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

    let debug = {
        version: ver,
        env: {
            url_set: !!EVOLUTION_API_URL,
            url_val: EVOLUTION_API_URL?.substring(0, 15) + '...',
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
            const eRes = await fetch(EVOLUTION_API_URL + '/instance/fetchInstances', {
                headers: { 'apikey': EVOLUTION_API_KEY?.trim() || '' }
            });
            debug.tests.evo_instances_status = eRes.status;
            const text = await eRes.text();
            debug.tests.evo_instances_preview = text.substring(0, 100);
        } catch (e) {
            debug.tests.evo_instances_error = e.message;
        }
    }

    return NextResponse.json(debug);
}
