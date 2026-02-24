const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function criarLeadManual() {
    console.log('Iniciando criacao manual...');
    try {
        // 1. Cria ou pega o Lead
        let { data: lead, error: leadErr } = await supabase
            .from('leads')
            .select('id')
            .eq('phone', '5537998070486')
            .maybeSingle();

        if (!lead) {
            console.log('Lead nao existe, criando...');
            const { data: newLead, error: insertErr } = await supabase
                .from('leads')
                .insert([{ name: 'Thiago', phone: '5537998070486', status: 'novo' }])
                .select()
                .single();

            if (insertErr) throw insertErr;
            lead = newLead;
        } else {
            console.log('Lead ja existe. ID:', lead.id);
        }

        // 2. Cria o Agendamento para daqui 2 minutos
        const agendamentoDate = new Date();
        agendamentoDate.setMinutes(agendamentoDate.getMinutes() + 2);

        console.log('Criando agendamento para:', agendamentoDate.toISOString());

        const { data: agenda, error: agendaErr } = await supabase
            .from('agendamentos')
            .insert([{
                lead_id: lead.id,
                service: 'Teste Evolution Zap',
                date_time: agendamentoDate.toISOString()
            }])
            .select();

        if (agendaErr) throw agendaErr;

        console.log('✅ Sucesso! Agendamento criado. O robô vai enviar a mensagem em 2 minutos.');

    } catch (error) {
        console.error('❌ Erro:', error);
    }
}

criarLeadManual();
