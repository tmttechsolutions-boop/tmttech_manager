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

        const { data: empresas } = await supabase.from('empresas').select('id, nome, whatsapp_instance');

        return NextResponse.json({
            debug_v: '3.3-instance-map',
            evolutionAudit,
            crm_config: empresas
        });
    } catch (err) {
        return NextResponse.json({ error: err.message });
    }
}
