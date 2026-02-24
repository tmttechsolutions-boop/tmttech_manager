'use server';

import { createSupabaseClient } from '@/lib/supabase';

export async function cadastrarLeadAction(newLead) {
    const supabase = createSupabaseClient();
    try {
        // 1. Verifica se o lead já existe pelo telefone
        let { data: existingLead } = await supabase
            .from('leads')
            .select('id')
            .eq('telefone', newLead.phone)
            .maybeSingle();

        let leadId = null;

        if (existingLead) {
            leadId = existingLead.id;
        } else {
            // Se não existir, cria
            const { data: leadReq, error: leadErr } = await supabase
                .from('leads')
                .insert([{ nome: newLead.name, telefone: newLead.phone, status: 'novo' }])
                .select()
                .single();

            if (leadErr) throw leadErr;
            leadId = leadReq.id;
        }

        // 2. Cria o agendamento
        const agendamentoDate = new Date();
        agendamentoDate.setMinutes(agendamentoDate.getMinutes() + 2); // Agendado pra daqui 2 min pra dar tempo

        const { error: agErr } = await supabase
            .from('agendamentos')
            .insert([{
                lead_id: leadId,
                service: newLead.service,
                date_time: agendamentoDate.toISOString()
            }]);

        if (agErr) throw agErr;

        return { success: true };
    } catch (error) {
        console.error("Erro na Server Action:", error);
        return { success: false, message: error.message || JSON.stringify(error) };
    }
}
