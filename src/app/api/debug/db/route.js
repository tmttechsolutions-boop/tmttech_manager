import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function GET(req) {
    try {
        const supabase = createSupabaseClient(true);

        const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
        const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
        const keyClean = EVOLUTION_API_KEY?.trim() || '';

        let evolutionAudit = [];
        if (EVOLUTION_API_URL && keyClean) {
            try {
                const res = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
                    headers: {
                        'apikey': keyClean,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });
                const resCloneForError = res.clone();
                try {
                    const instances = await res.json();
                    if (Array.isArray(instances)) {
                        evolutionAudit = instances.map(inst => ({
                            instanceName: inst.instanceName,
                            status: inst.status,
                            owner: inst.ownerJid || 'not-connected'
                        }));
                    } else {
                        evolutionAudit = { error: 'Evolution returned non-array', raw: instances };
                    }
                } catch (jsonErr) {
                    const textContent = await resCloneForError.text();
                    evolutionAudit = {
                        error: 'JSON Parse Error (Server returned HTML)',
                        status: res.status,
                        preview: textContent.substring(0, 500)
                    };
                }
            } catch (e) {
                evolutionAudit = { error: e.message };
            }
        }

        const { searchParams } = new URL(req.url);
        const reset = searchParams.get('reset');

        if (reset === 'true') {
            console.log('--- PERFORMANCE RESET: Clearing sessions and logs ---');
            await supabase.from('active_menus').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('message_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            return NextResponse.json({ success: true, message: 'Sessions and logs cleared' });
        }

        const { data: rules } = await supabase.from('automation_rules').select('*').limit(20);
        const { data: logs } = await supabase.from('message_logs').select('*, leads(nome, telefone), automation_rules(name)').order('created_at', { ascending: false }).limit(20);
        const { data: activeMenus } = await supabase.from('active_menus').select('*, leads(nome, telefone)');
        const { data: chats } = await supabase.from('chat_messages').select('content, direction, created_at, leads(nome)').order('created_at', { ascending: false }).limit(5);
        const { data: delays } = await supabase.from('delayed_messages').select('*').order('created_at', { ascending: false }).limit(5);

        const { data: empresas } = await supabase.from('empresas').select('id, nome, whatsapp_instance');

        return NextResponse.json({
            debug_v: '4.3-automation-audit',
            evolutionAudit,
            crm_config: empresas,
            activeMenus,
            recentChats: chats,
            recentDelays: delays,
            automations: rules,
            execution_logs: logs
        });
    } catch (err) {
        return NextResponse.json({ error: err.message });
    }
}
