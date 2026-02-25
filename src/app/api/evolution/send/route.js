import { NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@/lib/evolution';

export async function POST(req) {
    try {
        const { empresaId, phone, text } = await req.json();

        if (!empresaId || !phone || !text) {
            return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
        }
        // A função sendWhatsAppMessage no lib/evolution agora aceita empresaId para rotear para a instância certa
        const result = await sendWhatsAppMessage(phone, text, empresaId);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ success: true, evolution: result.result }, { status: 200 });

    } catch (error) {
        console.error('Erro na API de Chat Send:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
