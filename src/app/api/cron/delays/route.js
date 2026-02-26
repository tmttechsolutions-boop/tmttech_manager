import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import { executeFlow } from '@/lib/flow-engine';

export async function GET(req) {
    try {
        const supabase = createSupabaseClient();
        console.log(`⏱️ [CRON DELAYS] Verificando mensagens agendadas... ${new Date().toLocaleString()}`);

        // 1. Busca mensagens pendentes que já passaram do horário
        const { data: delays, error } = await supabase
            .from('delayed_messages')
            .select('*')
            .eq('status', 'pending')
            .lte('scheduled_for', new Date().toISOString());

        if (error) throw error;

        if (!delays || delays.length === 0) {
            return NextResponse.json({ message: 'Nenhuma mensagem pendente no momento.' }, { status: 200 });
        }

        console.log(`🚀 [CRON DELAYS] Processando ${delays.length} mensagem(ns)...`);
        let processados = 0;

        for (const delay of delays) {
            try {
                // 2. Carrega a regra completa (para ter os nodes/edges)
                const { data: rule } = await supabase
                    .from('automation_rules')
                    .select('*')
                    .eq('id', delay.rule_id)
                    .single();

                if (!rule || !rule.flow_data) {
                    console.error(`❌ Regra ${delay.rule_id} não encontrada ou sem dados de fluxo.`);
                    await supabase.from('delayed_messages').update({ status: 'error', error_message: 'Regra não encontrada' }).eq('id', delay.id);
                    continue;
                }

                // 3. Carrega o Lead
                const { data: lead } = await supabase
                    .from('leads')
                    .select('*')
                    .eq('id', delay.lead_id)
                    .single();

                if (!lead) {
                    console.error(`❌ Lead ${delay.lead_id} não encontrado.`);
                    await supabase.from('delayed_messages').update({ status: 'error', error_message: 'Lead não encontrado' }).eq('id', delay.id);
                    continue;
                }

                console.log(`🤖 [CRON DELAYS] Continuando fluxo para ${lead.nome} a partir do nó ${delay.node_id}`);

                // 4. Continua a execução através do Flow Engine
                await executeFlow({
                    nodes: rule.flow_data.nodes,
                    edges: rule.flow_data.edges,
                    currentNodeId: delay.node_id, // Começa do próprio nó de delay para seguir os próximos edges
                    lead: lead,
                    empresaId: delay.empresa_id,
                    ruleId: rule.id,
                    supabase
                });

                // 5. Marca como concluído
                await supabase.from('delayed_messages').update({ status: 'sent' }).eq('id', delay.id);
                console.log(`✅ [CRON DELAYS] Mensagem processada com sucesso: ${delay.id}`);
                processados++;

            } catch (err) {
                console.error(`❌ Erro ao processar delay ${delay.id}:`, err);
                await supabase.from('delayed_messages').update({ status: 'error', error_message: err.message }).eq('id', delay.id);
            }
        }

        return NextResponse.json({
            message: 'Processamento de Atrasos concluído!',
            total_processados: processados
        }, { status: 200 });

    } catch (error) {
        console.error('Erro no Cron de Delays:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
