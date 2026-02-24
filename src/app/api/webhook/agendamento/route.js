import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function POST(req) {
    try {
        const supabase = createSupabaseClient();
        const data = await req.json();

        // Supondo a estrutura SaaS: { name, phone, service, date_time, empresa_id }
        const { name, phone, service, date_time, empresa_id } = data;

        if (!name || !phone || !date_time || !empresa_id) {
            return NextResponse.json({ error: 'Faltam campos obrigatórios (name, phone, date_time, empresa_id)' }, { status: 400 });
        }

        // 1. Verifica se o Lead (Cliente) já existe nesta empresa específica, se não cria um novo.
        let { data: lead, error: leadError } = await supabase
            .from('leads')
            .select('id')
            .eq('telefone', phone)
            .eq('empresa_id', empresa_id)
            .single();

        if (!lead) {
            const { data: newLead, error } = await supabase
                .from('leads')
                .insert([{ nome: name, telefone: phone, status: 'agendado', empresa_id: empresa_id }])
                .select()
                .single();

            if (error) throw error;
            lead = newLead;
        }

        // 2. Cria o novo Agendamento atrelado ao Lead e à Empresa
        const { data: agendamento, error: agendamentoError } = await supabase
            .from('agendamentos')
            .insert([{
                lead_id: lead.id,
                empresa_id: empresa_id,
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
