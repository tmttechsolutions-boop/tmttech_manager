import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function GET(req) {
    try {
        const supabase = createSupabaseClient(true);
        const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
        const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
        const keyClean = EVOLUTION_API_KEY?.trim() || '';

        let evolutionAudit = {
            status: 'unknown',
            ts: Date.now(),
            vercel_to_google: 'not-tested'
        };

        if (EVOLUTION_API_URL && keyClean) {
            try {
                // Teste de Google para base de rede
                const gRes = await fetch('https://www.google.com', { method: 'HEAD' });
                evolutionAudit.vercel_to_google = `Success: ${gRes.status}`;

                // Teste de Evolution (GET Instances)
                const res = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
                    headers: {
                        'apikey': keyClean,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });

                // Teste extra da URL sugerida pelo usuário
                try {
                    const managerRes = await fetch('https://evo.testen8n.com.br/manager/', { method: 'HEAD' });
                    evolutionAudit.manager_url_status = managerRes.status;
                } catch (mErr) {
                    evolutionAudit.manager_url_error = mErr.message;
                }

                if (res.ok) {
                    const instances = await res.json().catch(() => []);
                    evolutionAudit.status = 'connected';
                    evolutionAudit.instances = instances.map(inst => ({
                        name: inst.instanceName,
                        state: inst.status,
                        owner: inst.ownerJid
                    }));
                } else {
                    const errText = await res.text().catch(() => 'no-body');
                    evolutionAudit.status = 'error-' + res.status;
                    evolutionAudit.preview = errText.substring(0, 200);
                }
            } catch (e) {
                evolutionAudit.error = e.message;
            }
        }

        const { searchParams } = new URL(req.url);
        const reset = searchParams.get('reset');

        if (reset === 'true') {
            await supabase.from('active_menus').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('message_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            return NextResponse.json({ success: true, message: 'Sessions and logs cleared' });
        }

        // Dados do CRM
        const { data: rules } = await supabase.from('automation_rules').select('*').limit(20);
        const { data: logs } = await supabase.from('message_logs').select('*, leads(nome, telefone), automation_rules(name)').order('created_at', { ascending: false }).limit(20);
        const { data: activeMenus } = await supabase.from('active_menus').select('*, leads(nome, telefone)');
        const { data: chats } = await supabase.from('chat_messages').select('content, direction, created_at, leads(nome)').order('created_at', { ascending: false }).limit(10);

        const { data: empresas } = await supabase.from('empresas').select('id, nome, whatsapp_instance');

        return NextResponse.json({
            debug_v: "5.2-full-audit",
            evolutionAudit,
            crm_config: empresas,
            activeMenus,
            recentChats: chats,
            automations: rules,
            execution_logs: logs
        });
    } catch (err) {
        return NextResponse.json({ error: err.message });
    }
}
