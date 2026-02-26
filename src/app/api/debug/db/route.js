import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function GET() {
    try {
        const supabase = createSupabaseClient(true);

        const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
        const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
        const keyClean = EVOLUTION_API_KEY?.trim() || '';

        let evolutionAudit = { status: 'not_checked' };
        if (EVOLUTION_API_URL && keyClean) {
            try {
                const res = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
                    headers: { 'apikey': keyClean }
                });
                const instances = await res.json();

                // Mapeia o que está no Evolution Agora
                evolutionAudit = Array.isArray(instances) ? instances.map(inst => ({
                    name: inst.instanceName,
                    connectionStatus: inst.status,
                    phone: inst.ownerJid?.split('@')[0] || 'not-connected'
                })) : { raw: instances };
            } catch (e) {
                evolutionAudit = { error: e.message };
            }
        }

        const { data: empresas } = await supabase.from('empresas').select('id, nome, whatsapp_instance');

        return NextResponse.json({
            debug_v: '3.2-instance-audit',
            evolutionAudit,
            empresas_config: empresas
        });
    } catch (err) {
        return NextResponse.json({ error: err.message });
    }
}
