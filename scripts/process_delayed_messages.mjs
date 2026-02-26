import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { executeFlow } from '../src/lib/flow-engine.js';

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Erro: Variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontradas.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function processDelays() {
    console.log(`⏱️ [POLLER] Verificando mensagens agendadas... ${new Date().toLocaleString()}`);

    try {
        // 1. Busca mensagens pendentes que já passaram do horário
        const { data: delays, error } = await supabase
            .from('delayed_messages')
            .select('*')
            .eq('status', 'pending')
            .lte('scheduled_for', new Date().toISOString());

        if (error) throw error;
        if (!delays || delays.length === 0) {
            console.log("✅ Nenhuma mensagem pendente para agora.");
            return;
        }

        console.log(`🚀 [POLLER] Processando ${delays.length} mensagem(ns)...`);

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

                console.log(`🤖 [POLLER] Continuando fluxo para ${lead.nome} a partir do nó ${delay.node_id}`);

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
                console.log(`✅ [POLLER] Mensagem processada com sucesso: ${delay.id}`);

            } catch (err) {
                console.error(`❌ Erro ao processar delay ${delay.id}:`, err);
                await supabase.from('delayed_messages').update({ status: 'error', error_message: err.message }).eq('id', delay.id);
            }
        }
    } catch (err) {
        console.error("❌ Erro crítico no Poller:", err);
    }
}

// Executa uma vez no modo script (se quiser loop, descomente o setInterval)
processDelays();
