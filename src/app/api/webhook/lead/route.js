import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req) {
    try {
        const data = await req.json();

        // Supondo a estrutura: { name, phone, source }
        const { name, phone, source } = data;

        if (!name || !phone) {
            return NextResponse.json({ error: 'Faltam campos obrigatórios (name, phone)' }, { status: 400 });
        }

        // Salva o novo lead do webhook (ex: Instagram, Site)
        const { data: newLead, error } = await supabase
            .from('leads')
            .insert([{
                name,
                phone,
                status: 'novo',
                source: source || 'webhook'
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
