import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/evolution';

// Esta rota deve ser chamada externamente a cada 5 ou 10 minutos (ex: por cron-job.org)
export async function GET(req) {
    try {
        const supabase = createSupabaseClient();
        // 1. Busca todas as regras ATIVAS
        const { data: rules, error: rulesError } = await supabase
            .from('automation_rules')
            .select('*')
            .eq('is_active', true);

        if (rulesError) throw rulesError;
        if (!rules || rules.length === 0) {
            return NextResponse.json({ message: 'Nenhuma regra ativa para processar.' });
        }

        let mensagensEnviadas = 0;
        const nowLocal = new Date();

        // 2. Itera sobre cada Regra de Automação Ativa
        for (const rule of rules) {
            if (rule.trigger_type === 'agendamento') {

                // Exemplo: Offset -120 minutos (2 horas ANTES).
                // Se agora é 10h00, queremos achar agendamentos entre 11h55 e 12h05.
                // A lógica de janela ajuda a não perder caso o cron atrase uns minuts.

                const targetTimeWindowStart = new Date(nowLocal.getTime() - (rule.offset_minutes * 60000) - (5 * 60000));
                const targetTimeWindowEnd = new Date(nowLocal.getTime() - (rule.offset_minutes * 60000) + (5 * 60000));

                // Busca agendamentos nessa janela que AINDA NÃO receberam mensagem desta regra
                const { data: agendamentos, error: agendamentosError } = await supabase
                    .from('agendamentos')
                    .select('*, leads(*)')
                    .gte('date_time', targetTimeWindowStart.toISOString())
                    .lte('date_time', targetTimeWindowEnd.toISOString());

                if (agendamentosError) continue;

                for (const ag of agendamentos) {
                    // Verifica se já enviamos essa exata regra para esse agendamento (usando a tabela logs)
                    const { data: jaEnviado } = await supabase
                        .from('message_logs')
                        .select('id')
                        .eq('rule_id', rule.id)
                        .eq('agendamento_id', ag.id)
                        .single();

                    if (!jaEnviado && ag.leads) {
                        // Monta a mensagem final substituindo as variáveis mágicas
                        const agendamentoData = new Date(ag.date_time);
                        const horaFormatada = agendamentoData.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                        let mensagemFinal = rule.message_template
                            .replace('{{nome}}', ag.leads.nome)
                            .replace('{{servico}}', ag.service)
                            .replace('{{hora}}', horaFormatada);

                        // ============================================
                        // CONEXÃO EVOLUTION API OFICIAL!
                        // ============================================
                        console.log(`[DISPARO CRON WHATSAPP] Para: ${ag.leads.telefone} -> Mensagem: ${mensagemFinal}`);
                        await sendWhatsAppMessage(ag.leads.telefone, mensagemFinal);

                        // Registra no Log que a mensagem foi enviada para não mandar duas vezes
                        await supabase.from('message_logs').insert([{
                            rule_id: rule.id,
                            lead_id: ag.leads.id,
                            agendamento_id: ag.id,
                            status: 'enviado'
                        }]);

                        mensagensEnviadas++;
                    }
                }
            }
        }

        return NextResponse.json({
            message: 'Processamento do Cron Job concluído!',
            total_disparos: mensagensEnviadas
        }, { status: 200 });

    } catch (error) {
        console.error('Erro no Cron Job:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
