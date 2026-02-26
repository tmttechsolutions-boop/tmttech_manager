import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function GET() {
    try {
        const supabase = createSupabaseClient(true);

        const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
        const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
        const keyClean = EVOLUTION_API_KEY?.trim() || '';

        let evolutionAudit = [];
        if (EVOLUTION_API_URL && keyClean) {
            try {
                const res = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
                    headers: { 'apikey': keyClean }
                });
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
            } catch (e) {
                evolutionAudit = { error: e.message };
            }
        }

        const { data: rules } = await supabase.from('automation_rules').select('*').limit(20);
        const { data: logs } = await supabase.from('message_logs').select('*, leads(nome, telefone), automation_rules(name)').order('created_at', { ascending: false }).limit(20);

        const { data: empresas } = await supabase.from('empresas').select('id, nome, whatsapp_instance');

        return NextResponse.json({
            debug_v: '4.0-automation-audit',
            evolutionAudit,
            crm_config: empresas,
            automations: rules,
            execution_logs: logs
        });
    } catch (err) {
        return NextResponse.json({ error: err.message });
    }
}
