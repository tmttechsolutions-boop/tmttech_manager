import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function GET() {
    try {
        const supabase = createSupabaseClient(true); // Admin client

        // 1. Audit Empresas
        const { data: empresas } = await supabase
            .from('empresas')
            .select('*');

        // 2. Audit Chat Messages
        const { data: messages } = await supabase
            .from('chat_messages')
            .select('*, leads(nome, telefone)')
            .order('created_at', { ascending: false })
            .limit(20);

        return NextResponse.json({
            debug_v: '3.1-db-only-audit',
            empresas,
            messages
        });
    } catch (err) {
        return NextResponse.json({ error: err.message });
    }
}
