import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

export async function POST(req) {
    try {
        const supabase = createSupabaseClient();
        const data = await req.json();

        // Supondo a estrutura SaaS: { name, phone, source, empresa_id }
        const { name, phone, source, empresa_id } = data;

        if (!name || !phone || !empresa_id) {
            return NextResponse.json({ error: 'Faltam campos obrigatórios (name, phone, empresa_id)' }, { status: 400 });
        }

        // Salva o novo lead no CRM da Empresa (Tenant) específica
        const { data: newLead, error } = await supabase
            .from('leads')
            .insert([{
                nome: name,
                telefone: phone,
                status: 'novo',
                source: source || 'webhook',
                empresa_id: empresa_id
            }])
            .select()
            .single();

        if (error) throw error;

        // TODO: Aqui integraríamos a resposta automática da Evolution API / Baileys
        // ex: await enviarMensagemWhatsApp(phone, `Olá ${name}! Recebemos seu contato...`);

        return NextResponse.json({
            message: 'Lead capturado com sucesso!',
            lead: newLead
        }, { status: 201 });

    } catch (error) {
        console.error('Erro no Webhook de Lead:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
