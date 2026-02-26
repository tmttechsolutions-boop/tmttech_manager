import { createSupabaseClient } from './supabase';
import { sendWhatsAppMessage, sendWhatsAppInteractiveMenu } from './evolution';

/**
 * Motor de execução de fluxos visuais (React Flow)
 */
export async function executeFlow({
    nodes,
    edges,
    currentNodeId,
    lead,
    empresaId,
    ruleId,
    supabase = null
}) {
    if (!supabase) supabase = createSupabaseClient(true);

    const connections = edges.filter(e => e.source === currentNodeId);
    let messagesCount = 0;

    for (const edge of connections) {
        const targetNode = nodes.find(n => n.id === edge.target);
        if (!targetNode) continue;

        if (targetNode.type === 'action' && targetNode.data?.message) {
            // SUBSTITUIÇÃO DE VARIÁVEIS ROBUSTA
            const phone = lead.telefone;
            let mensagemFinal = targetNode.data.message
                .replace(/{{nome}}/gi, lead.nome || 'cliente')
                .replace(/{nome}/gi, lead.nome || 'cliente')
                .replace(/{Nome do contato}/gi, lead.nome || 'cliente')
                .replace(/{{telefone}}/gi, phone)
                .replace(/{telefone}/gi, phone);

            // Injeção de variáveis extras (ex: vindas do Webhook Externo via contextLead)
            Object.keys(lead).forEach(key => {
                if (key !== 'nome' && key !== 'telefone' && typeof lead[key] === 'string') {
                    const regex1 = new RegExp(`{{${key}}}`, 'gi');
                    const regex2 = new RegExp(`{${key}}`, 'gi');
                    mensagemFinal = mensagemFinal.replace(regex1, lead[key]).replace(regex2, lead[key]);
                }
            });

            console.log(`🤖 [FLOW ENGINE] Enviando Mensagem: ${targetNode.id}`);
            await sendWhatsAppMessage(phone, mensagemFinal, empresaId);
            messagesCount++;

            // Continua o fluxo (Recursivo)
            const subCount = await executeFlow({ nodes, edges, currentNodeId: targetNode.id, lead, empresaId, ruleId, supabase });
            messagesCount += subCount;

        } else if (targetNode.type === 'delay') {
            // Lógica de ATRASO (DELAY)
            const value = parseInt(targetNode.data.delayValue) || 1;
            const unit = targetNode.data.delayUnit || 'Minutos';

            let scheduledFor = new Date();
            if (unit === 'Segundos') scheduledFor.setSeconds(scheduledFor.getSeconds() + value);
            else if (unit === 'Minutos') scheduledFor.setMinutes(scheduledFor.getMinutes() + value);
            else if (unit === 'Horas') scheduledFor.setHours(scheduledFor.getHours() + value);
            else if (unit === 'Dias') scheduledFor.setDate(scheduledFor.getDate() + value);

            console.log(`⏱️ [FLOW ENGINE] Agendando Delay: ${value} ${unit} para ${scheduledFor.toISOString()}`);

            // Busca a regra_id se não estiver disponível (precisamos dela para o poller)
            // Aqui assumimos que quem chama sabe o context - mas podemos tentar encontrar
            // Por simplicidade, assumimos que o poller vai precisar disso.

            await supabase.from('delayed_messages').insert([{
                empresa_id: empresaId,
                lead_id: lead.id,
                rule_id: ruleId,
                node_id: targetNode.id,
                scheduled_for: scheduledFor.toISOString(),
                status: 'pending'
            }]);

            // Pausa este ramo
        } else if (targetNode.type === 'menu') {
            // Lógica de MENU (Menu Interativo)
            const buttons = targetNode.data.buttons || [];
            if (buttons.length === 0) continue;

            const phone = lead.telefone;

            // Construir a mensagem com numeração (Fallback para Botões Nativos Rotos)
            let menuText = targetNode.data.message || 'Selecione uma das opções:';
            menuText = menuText
                .replace(/{{nome}}/gi, lead.nome || 'cliente')
                .replace(/{nome}/gi, lead.nome || 'cliente')
                .replace(/{Nome do contato}/gi, lead.nome || 'cliente')
                .replace(/{{telefone}}/gi, phone)
                .replace(/{telefone}/gi, phone);

            menuText += '\n\n';
            buttons.forEach((btn, idx) => {
                menuText += `${idx + 1} - ${btn}\n`;
            });

            // Registrar estado de menu ativo ANTES de enviar a mensagem
            // Isso previne a race condition extrema onde o usuário responde antes
            // do Node.js terminar de gravar no banco devido a delays de compilação local
            await supabase.from('active_menus').upsert({
                empresa_id: empresaId,
                lead_id: lead.id,
                rule_id: ruleId,
                node_id: targetNode.id,
                created_at: new Date().toISOString()
            }, { onConflict: 'lead_id' });

            console.log(`🤖 [FLOW ENGINE] Enviando Menu (Texto Clássico): ${targetNode.id}`);
            await sendWhatsAppMessage(phone, menuText, empresaId);
            messagesCount++;

            // PAUSAR O FLUXO (não propaga agora, apenas quando o cliente responder)
        }

    }

    return messagesCount;
}
