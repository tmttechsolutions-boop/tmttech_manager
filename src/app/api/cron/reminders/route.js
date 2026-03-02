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
        const maxReminderWindow = new Date(now.getTime() + (2.25 * 60 * 60 * 1000)); // Agora + 2h15m

        console.log(`[CRON EXTR] Buscando agendamentos pendentes... Limit: ${maxReminderWindow.toISOString()}`);

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

            const url = new URL(req.url);
            const testPhone = url.searchParams.get('testPhone');

            // Formatar telefone (A Evolution requer código do país 55 para o Brasil)
            let cleanPhone = ag.clients.phone.replace(/\D/g, '');
            if (!cleanPhone.startsWith('55')) {
                cleanPhone = `55${cleanPhone}`;
            }

            // LÓGICA DA JANELA À PROVA DE FALHAS:
            // Dispara se o agendamento ocorrer nas próximas 2h15m e ainda estiver no futuro.
            const isTimeMatch = agDateTime <= maxReminderWindow && agDateTime > now;
            const isTestMatch = testPhone && cleanPhone === testPhone;

            if (isTimeMatch || isTestMatch) {

                const timeStr = ag.appointment_time.substring(0, 5); // "HH:mm"
                const dateParts = ag.appointment_date.split('-');
                const dateStr = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

                // Extrai primeiro nome
                const clientName = ag.clients.name ? ag.clients.name.split(' ')[0] : 'Cliente';

                console.log(`[CRON EXTR] Agendamento prestes a ocorrer: ${cleanPhone} (Ag: ${ag.id})`);

                // 2. Busca regra de automação que seja do tipo "remetente_2h" ativa
                const supabaseLocal = createSupabaseClient(true);
                const { data: activeRules } = await supabaseLocal
                    .from('automation_rules')
                    .select('*')
                    .eq('is_active', true);

                let targetRule = null;
                let triggerNodeId = null;

                if (activeRules) {
                    for (const rule of activeRules) {
                        const flowData = rule.flow_data || {};
                        const nodes = flowData.nodes || [];
                        const triggerNode = nodes.find(n => n.type === 'trigger' && n.data?.triggerType === 'remetente_2h');
                        if (triggerNode) {
                            targetRule = rule;
                            triggerNodeId = triggerNode.id;
                            break;
                        }
                    }
                }

                if (!targetRule) {
                    console.log(`[CRON EXTR] Nenhuma automação visual ativa com o gatilho "Lembrete 2h".`);
                    // Fallback cancelado. Se não tem regra, não envia nada e continua.
                    continue;
                }

                // 3. Garante que o Lead existe localmente para podermos usar o Flow Engine
                const empresaId = targetRule.empresa_id;
                let { data: lead } = await supabaseLocal
                    .from('leads')
                    .select('*')
                    .eq('telefone', cleanPhone)
                    .eq('empresa_id', empresaId)
                    .maybeSingle();

                if (!lead) {
                    const { data: newLead } = await supabaseLocal
                        .from('leads')
                        .insert([{
                            nome: clientName,
                            telefone: cleanPhone,
                            empresa_id: empresaId,
                            status: 'novo'
                        }])
                        .select()
                        .single();
                    lead = newLead;
                }

                // Injeta as variáveis de agendamento transientes no objeto Lead
                // para o replaceVars() do flow-engine capturar
                lead.data_agendamento = dateStr;
                lead.hora_agendamento = timeStr;

                // 4. Executa o Flow Visual (Import dinâmico para evitar dependência circular pesada se houver)
                const { executeFlow } = await import('@/lib/flow-engine');

                console.log(`[CRON EXTR] Iniciando Flow visual "${targetRule.name}" para ${cleanPhone}`);

                try {
                    await executeFlow({
                        nodes: targetRule.flow_data.nodes,
                        edges: targetRule.flow_data.edges || [],
                        currentNodeId: triggerNodeId,
                        lead: lead,
                        empresaId: empresaId,
                        ruleId: targetRule.id,
                        supabase: supabaseLocal
                    });

                    // Update IMEDIATO no banco externo marcando que já recebeu o aviso
                    const { error: upError } = await supabaseExternal
                        .from('appointments')
                        .update({ reminder_sent: true })
                        .eq('id', ag.id);

                    if (upError) {
                        console.error(`[CRON EXTR] Erro ao marcar reminder_sent para ${ag.id}:`, upError);
                    } else {
                        sentCount++;
                    }
                } catch (err) {
                    console.error(`[CRON EXTR] Erro fatal durante a execução do Lembrete Flow:`, err);
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
