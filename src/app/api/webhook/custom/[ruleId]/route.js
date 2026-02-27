import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import { executeFlow } from '@/lib/flow-engine';

/**
 * Endpoint curinga para Webhooks Externos (Integrações com outros sites/apps)
 * URL Esperada: POST /api/webhook/custom/[ruleId]?empresaId=xxx
 * Body Esperado: { "phone": "5537...", "name": "Nome", "data": { ...variaveis adicionais } }
 */
export async function POST(req, { params }) {
    try {
        const { ruleId } = params;
        const url = new URL(req.url, 'http://localhost');
        const empresaId = url.searchParams.get('empresaId');

        if (!ruleId || !empresaId) {
            return NextResponse.json({ error: 'ruleId (URL param) and empresaId (Query param) are required.' }, { status: 400 });
        }

        const body = await req.json();
        const { phone, name, data: extraData = {} } = body;

        if (!phone) {
            return NextResponse.json({ error: 'O campo "phone" é obrigatório no payload JSON.' }, { status: 400 });
        }

        const supabase = createSupabaseClient(true); // admin mode

        // 1. Validar se a Automação existe e está ativa
        const { data: rule } = await supabase
            .from('automation_rules')
            .select('*')
            .eq('id', ruleId)
            .eq('empresa_id', empresaId)
            .single();

        if (!rule || !rule.is_active) {
            return NextResponse.json({ error: 'Automação não encontrada, desativada ou não pertence a esta empresa.' }, { status: 404 });
        }

        // 2. Extrair o fluxo
        const nodes = rule.flow_data?.nodes || [];
        const edges = rule.flow_data?.edges || [];

        // 3. Encontrar o nó gatilho do tipo 'webhook' que inicia tudo isso
        const triggerNode = nodes.find(n => n.type === 'trigger' && n.data?.triggerType === 'webhook');

        if (!triggerNode) {
            return NextResponse.json({ error: 'Esta automação não possui um gatilho do tipo Webhook configurado.' }, { status: 400 });
        }

        // 4. Buscar ou Criar o Lead
        const cleanPhone = phone.replace(/\D/g, '');
        let lead;

        const { data: existingLead } = await supabase
            .from('leads')
            .select('*')
            .eq('telefone', cleanPhone)
            .eq('empresa_id', empresaId)
            .maybeSingle();

        if (!existingLead) {
            const finalName = name || `Contato ${cleanPhone.slice(-4)}`;
            const { data: newLead, error: insertError } = await supabase
                .from('leads')
                .insert([{
                    nome: finalName,
                    telefone: cleanPhone,
                    status: 'novo',
                    empresa_id: empresaId
                }])
                .select()
                .single();

            if (insertError) throw insertError;
            lead = newLead;
        } else {
            lead = existingLead;
            if (name && lead.nome.startsWith('Contato ')) {
                // Atualiza nome genérico se o webhook mandou o nome real
                const { data: updatedLead } = await supabase
                    .from('leads')
                    .update({ nome: name })
                    .eq('id', lead.id)
                    .select()
                    .single();
                if (updatedLead) lead = updatedLead;
            }
        }

        console.log(`[EXTERNAL WEBHOOK] Iniciando Fluxo ${rule.name} para o lead ${lead.nome} (${lead.telefone})`);

        // OPTIONAL: Inyectar variáveis dinâmicas (extraData) no Lead temporariamente
        // Para que o flow-engine possa substituir {servico}, {data_agendamento} no texto
        // Faremos isso mesclando no objeto lead apenas em memória durante a execução
        const contextLead = {
            ...lead,
            ...extraData // ex: lead.servico, lead.data_hora estarão disponíveis para o replace
        };

        // 5. Acionar o Motor de Fluxos a partir deste nó gatilho
        // Não esperamos o await para não travar a resposta do webhook (fire and forget)
        executeFlow({
            nodes,
            edges,
            currentNodeId: triggerNode.id,
            lead: contextLead,
            empresaId,
            ruleId,
            supabase
        }).catch(err => console.error("Erro assíncrono executando fluxo via Webhook Externo:", err));

        // 6. Retornar SUCESSO imediatamente para o App (Barbearia)
        return NextResponse.json({ success: true, message: 'Webhook processado e fluxo iniciado.', lead_id: lead.id }, { status: 200 });

    } catch (error) {
        console.error('[EXTERNAL WEBHOOK ERROR]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
