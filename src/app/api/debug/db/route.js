import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function GET() {
    try {
        const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
        const serviceKeyLength = process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0;
        const anonKeyLength = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0;

        return NextResponse.json({
            debug_v: '2.8-env-audit',
            env_status: {
                has_service_role_key: hasServiceKey,
                service_key_length: serviceKeyLength,
                anon_key_length: anonKeyLength,
                service_role_matches_anon: process.env.SUPABASE_SERVICE_ROLE_KEY === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
            }
        });
    } catch (err) {
        return NextResponse.json({ error: err.message });
    }
}
