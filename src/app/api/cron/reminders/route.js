import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import { sendWhatsAppInteractiveMenu } from '@/lib/evolution';

// Rota de Polling: Consulta agendamentos pendentes para enviar lembretes com botões
export async function GET(req) {
    try {
        const supabase = createSupabaseClient(true);
        const now = new Date();

        // Janela de tempo: Agora até Agora + 2h15min
        const futureLimit = new Date(now.getTime() + (2.25 * 60 * 60 * 1000));

        console.log(`[CRON REMINDERS] Buscando agendamentos entre ${now.toISOString()} e ${futureLimit.toISOString()}`);

        // Busca agendamentos pendentes dentro da janela
        const { data: agendamentos, error: agError } = await supabase
            .from('agendamentos')
            .select('*, leads(id, nome, telefone)')
            .eq('status', 'pendente')
            .eq('reminder_sent', false)
            .gte('date_time', now.toISOString())
            .lte('date_time', futureLimit.toISOString());

        if (agError) throw agError;

        if (!agendamentos || agendamentos.length === 0) {
            return NextResponse.json({ message: 'Nenhum agendamento pendente na janela de 2h15.' });
        }

        let sentCount = 0;

        for (const ag of agendamentos) {
            if (!ag.leads || !ag.leads.telefone) continue;

            const agDate = new Date(ag.date_time);
            const timeStr = agDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const dateStr = agDate.toLocaleDateString('pt-BR');

            const message = `Olá, ${ag.leads.nome}! ✨\n\nPassando para lembrar do seu agendamento.\n\n📅 Data: ${dateStr}\n🕒 Hora: ${timeStr}\n🛠️ Serviço: ${ag.service || 'Procedimento'}\n\nPodemos confirmar sua presença?`;

            const buttons = [
                { id: `ag_confirm_${ag.id}`, title: 'Confirmar' },
                { id: `ag_reject_${ag.id}`, title: 'Rejeitar' }
            ];

            console.log(`[CRON REMINDERS] Enviando lembrete para: ${ag.leads.telefone} (Ag: ${ag.id})`);

            const result = await sendWhatsAppInteractiveMenu(ag.leads.telefone, message, buttons, ag.empresa_id);

            if (result.success) {
                // Marca como enviado imediatamente
                await supabase
                    .from('agendamentos')
                    .update({ reminder_sent: true })
                    .eq('id', ag.id);

                sentCount++;
            }
        }

        return NextResponse.json({
            message: 'Processamento de lembretes concluído.',
            total_enviados: sentCount
        });

    } catch (error) {
        console.error('[CRON REMINDERS ERROR]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
