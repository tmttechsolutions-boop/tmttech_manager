import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function GET() {
    try {
        const supabase = createSupabaseClient(true); // Admin client para audit completo

        // 1. Audit Empresas & Instâncias
        const { data: empresas } = await supabase
            .from('empresas')
            .select('*');

        // 2. Audit Chat Messages (Últimas 50 para ver o histórico real)
        const { data: messages } = await supabase
            .from('chat_messages')
            .select('*, leads(nome, telefone)')
            .order('created_at', { ascending: false })
            .limit(50);

        // 3. Consulta Evolution API para ver QUEM está conectado agora
        const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
        const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
        const keyClean = EVOLUTION_API_KEY?.trim() || '';

        let evolutionStatus = { status: 'not_checked' };
        if (EVOLUTION_API_URL && keyClean) {
            try {
                const res = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
                    headers: { 'apikey': keyClean }
                });
                evolutionStatus = await res.json().catch(() => ({ error: 'invalid-json' }));
            } catch (e) {
                evolutionStatus = { error: e.message };
            }
        }

        return NextResponse.json({
            debug_v: '3.0-switch-audit',
            evolutionStatus,
            empresas,
            messages
        });
    } catch (err) {
        return NextResponse.json({ error: err.message });
    }
}
