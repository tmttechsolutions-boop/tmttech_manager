import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import { sendWhatsAppInteractiveMenu, sendWhatsAppMessage } from '@/lib/evolution';
import { createClient } from '@supabase/supabase-js';

// Função auxiliar para criar a data exata do agendamento a partir das colunas
function parseAppointmentDateTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    // Assume Formato: dateStr "YYYY-MM-DD", timeStr "HH:mm:ss"
    return new Date(`${dateStr}T${timeStr}-03:00`); // Assumindo fuso de Brasília fixo para barbearias no BR
}

export async function GET(req) {
    try {
        const EXTERNAL_URL = process.env.EXTERNAL_SUPABASE_URL;
        const EXTERNAL_KEY = process.env.EXTERNAL_SUPABASE_ANON_KEY;

        if (!EXTERNAL_URL || !EXTERNAL_KEY) {
            throw new Error("Credenciais do banco de dados externo não configuradas (.env.local).");
        }

        const supabaseExternal = createClient(EXTERNAL_URL, EXTERNAL_KEY);

        const now = new Date();
        const futureLimit = new Date(now.getTime() + (2.25 * 60 * 60 * 1000)); // Agora + 2h15m

        console.log(`[CRON EXTR] Buscando agendamentos pendentes... Limit: ${futureLimit.toISOString()}`);

        // 1. Busca todos pendentes que ainda não receberam lembrete
        // Como o BD usa colunas separadas (date, time), trazemos tudo que for >= hoje (pra não puxar passado antigo)
        const todayStr = now.toISOString().split('T')[0];

        const { data: appointments, error: appError } = await supabaseExternal
            .from('appointments')
            .select('*, clients(name, phone)')
            .eq('status', 'pendente')
            .eq('reminder_sent', false)
            .gte('appointment_date', todayStr);

        if (appError) throw appError;

        if (!appointments || appointments.length === 0) {
            return NextResponse.json({ message: 'Nenhum agendamento pendente encontrado no banco externo.' });
        }

        let sentCount = 0;

        for (const ag of appointments) {
            if (!ag.clients || !ag.clients.phone) continue;

            const agDateTime = parseAppointmentDateTime(ag.appointment_date, ag.appointment_time);
            if (!agDateTime) continue;

            // LÓGICA DA JANELA:
            // "horário é menor ou igual a Agora + 2h15min"
            // E maior que "Agora" (para não mandar msg de coisas que já passaram, caso o cron atrase)
            if (agDateTime <= futureLimit && agDateTime >= now) {

                const timeStr = ag.appointment_time.substring(0, 5); // "HH:mm"
                const dateParts = ag.appointment_date.split('-');
                const dateStr = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

                // Extrai primeiro nome
                const clientName = ag.clients.name ? ag.clients.name.split(' ')[0] : 'Cliente';

                const message = `Olá, ${clientName}! ✨\n\nPassando para lembrar do seu agendamento.\n\n📅 Data: ${dateStr}\n🕒 Hora: ${timeStr}\n\nPodemos confirmar sua presença?`;

                const buttons = [
                    { id: `ext_ag_confirm_${ag.id}`, title: 'Confirmar' },
                    { id: `ext_ag_reject_${ag.id}`, title: 'Rejeitar' }
                ];

                console.log(`[CRON EXTR] Enviando lembrete para: ${ag.clients.phone} (Ag: ${ag.id})`);

                // Dispara pela Evolution (Usando a instância global/default do CRM)
                const result = await sendWhatsAppInteractiveMenu(ag.clients.phone, message, buttons);

                if (result.success) {
                    // Update IMEDIATO no banco externo
                    const { error: upError } = await supabaseExternal
                        .from('appointments')
                        .update({ reminder_sent: true })
                        .eq('id', ag.id);

                    if (upError) {
                        console.error(`[CRON EXTR] Erro ao marcar reminder_sent para ${ag.id}:`, upError);
                    } else {
                        sentCount++;
                    }
                }
            }
        }

        return NextResponse.json({
            message: 'Processamento de lembretes externos concluído.',
            total_avaliados: appointments.length,
            total_enviados: sentCount
        });

    } catch (error) {
        console.error('[CRON EXTR ERROR]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
