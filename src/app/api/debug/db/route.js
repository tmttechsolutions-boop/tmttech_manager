import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function GET() {
    try {
        const supabase = createSupabaseClient();

        // 1. Lista todas as empresas e suas instâncias configuradas
        const { data: empresas, error: empError } = await supabase
            .from('empresas')
            .select('*');

        const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
        const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

        return NextResponse.json({
            debug_version: '1.2-fixed',
            empresas_count: empresas?.length || 0,
            empresas: empresas,
            env: {
                has_url: !!EVOLUTION_API_URL,
                has_key: !!EVOLUTION_API_KEY,
                url_base: EVOLUTION_API_URL
            },
            db_error: empError?.message || null
        });
    } catch (err) {
        return NextResponse.json({ error: err.message, stack: err.stack });
    }
}
