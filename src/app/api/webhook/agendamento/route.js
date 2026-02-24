import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req) {
    try {
        const data = await req.json();

        // Supondo a estrutura: { name, phone, service, date_time }
        const { name, phone, service, date_time } = data;

        if (!name || !phone || !date_time) {
            return NextResponse.json({ error: 'Faltam campos obrigatórios' }, { status: 400 });
        }

        // 1. Verifica se o Lead (Cliente) já existe, se não cria um novo.
        let { data: lead, error: leadError } = await supabase
            .from('leads')
            .select('id')
            .eq('phone', phone)
            .single();

        if (!lead) {
            const { data: newLead, error } = await supabase
                .from('leads')
                .insert([{ name, phone, status: 'agendado' }])
                .select()
                .single();

            if (error) throw error;
            lead = newLead;
        }

        // 2. Cria o novo Agendamento
        const { data: agendamento, error: agendamentoError } = await supabase
            .from('agendamentos')
            .insert([{
                lead_id: lead.id,
                service: service || 'Atendimento Geral',
                date_time: date_time,
                status: 'confirmado',
                reminder_sent: false
            }])
            .select();

        if (agendamentoError) throw agendamentoError;

        return NextResponse.json({
            message: 'Agendamento e Lead processados com sucesso!',
            agendamento: agendamento[0]
        }, { status: 201 });

    } catch (error) {
        console.error('Erro no Webhook de Agendamento:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
