import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function GET() {
    try {
        const supabase = createSupabaseClient();

        // 1. Busca últimos logs de mensagens
        const { data: recentLogs } = await supabase
            .from('message_logs')
            .select('*, automation_rules(name, trigger_type)')
            .order('created_at', { ascending: false })
            .limit(10);

        // 2. Busca últimas mensagens de CHAT (O que aparece na UI)
        const { data: chatMessages } = await supabase
            .from('chat_messages')
            .select('*, leads(nome, telefone)')
            .order('created_at', { ascending: false })
            .limit(10);

        const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
        const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

        const keyClean = EVOLUTION_API_KEY?.trim() || '';

        return NextResponse.json({
            debug_v: '2.4-chat-viewer',
            env_vars: {
                EVOLUTION_API_URL,
                key_length: keyClean.length
            },
            chatMessages,
            recentLogs
        });
    } catch (err) {
        return NextResponse.json({ error: err.message });
    }
}
