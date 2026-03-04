import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/evolution';
import { executeFlow } from '@/lib/flow-engine';

/**
 * Webhook Universal para Evolution API v1 e v2
 * Suporta os eventos: messages.upsert, MESSAGES_UPSERT, etc.
 */
export async function POST(req) {
    try {
        const supabase = createSupabaseClient(true); // Bypass RLS
        const body = await req.json();

        // LOG DE DEBUG PARA CAPTURAR O PAYLOAD REAL
        try {
            const { data: debugLead } = await supabase.from('leads').select('id').eq('telefone', 'DEBUG').maybeSingle();
            if (debugLead) {
                await supabase.from('chat_messages').insert([{
                    empresa_id: '7598fb30-3852-4a75-9259-18825da4a316',
                    lead_id: debugLead.id,
                    direction: 'inbound',
                    content: `RAW_PAYLOAD: ${JSON.stringify(body).substring(0, 3000)}`,
                    message_type: 'text'
                }]);
            }
        } catch (e) {
            console.error('Debug log fail:', e);
        }

        const eventType = (body.event || body.type || '').toLowerCase();
        console.log(`[WHATSAPP WEBHOOK] Evento: ${eventType} | Instância: ${body.instance || body.instanceName}`);

        // 1. Identificação da Empresa
        const instanceName = body.instance || body.instanceName || '';
        let empresaId = null;

        const { data: empData } = await supabase
            .from('empresas')
            .select('id')
            .eq('whatsapp_instance', instanceName)
            .maybeSingle();

        if (empData) {
            empresaId = empData.id;
        } else {
            // Fallback para única empresa se não houver mapeamento
            const { data: allEmp } = await supabase.from('empresas').select('id').limit(2);
            if (allEmp && allEmp.length === 1) {
                empresaId = allEmp[0].id;
            }
        }

        if (!empresaId) {
            console.warn(`[WHATSAPP WEBHOOK] Empresa não identificada para instância: ${instanceName}`);
            return NextResponse.json({ message: 'Instância não mapeada.' }, { status: 200 });
        }

        // 2. Extração Defensiva da Mensagem (Suporte v1, v2 e Webhook por evento)
        let messageData = null;

        // Caso 1: Array de mensagens (padrão v2 notify)
        if (body.data?.messages?.[0]) {
            messageData = body.data.messages[0];
        }
        // Caso 2: Objeto direto (padrão v1 ou v2 direto)
        else if (body.data?.key) {
            messageData = body.data;
        }
        // Caso 3: Fallback para o próprio body se for simplificado
        else if (body.key) {
            messageData = body;
        }

        if (!messageData || !messageData.key) {
            // Se for um evento de conexão ou status, ignoramos sem erro
            return NextResponse.json({ message: 'Evento ignorado (sem dados de mensagem)' }, { status: 200 });
        }

        const remoteJid = messageData.key.remoteJid || '';
        const isFromMe = messageData.key.fromMe === true;
        const isGroup = remoteJid.includes('@g.us');

        if (isGroup) {
            return NextResponse.json({ message: 'Ignore: group message' }, { status: 200 });
        }

        // Extração do Telefone/ID
        let phone = remoteJid.split('@')[0];
        if (!phone) {
            return NextResponse.json({ message: 'Ignore: no sender ID' }, { status: 200 });
        }

        // Normalização de números brasileiros (adiciona o 9)
        if (phone.startsWith('55') && phone.length === 12) {
            phone = phone.substring(0, 4) + '9' + phone.substring(4);
        }

        // Extração de Conteúdo (Texto)
        const text = messageData.message?.conversation ||
            messageData.message?.extendedTextMessage?.text ||
            messageData.content ||
            body.text ||
            "";

        // Extração de Nome
        const pushNameRaw = messageData.pushName || body.pushName || "";
        const pushName = (pushNameRaw && pushNameRaw !== phone) ? pushNameRaw : "";

        console.log(`[WHATSAPP WEBHOOK] Mensagem de ${phone} (${pushName || 'Sem Nome'}): "${text.substring(0, 30)}..."`);

        // 3. Persistência do Lead
        let { data: lead } = await supabase
            .from('leads')
            .select('*')
            .eq('telefone', phone)
            .maybeSingle();

        if (!lead) {
            const finalName = pushName || `Contato ${phone.slice(-4)}`;
            const { data: newLead, error: insertError } = await supabase
                .from('leads')
                .insert([{
                    nome: finalName,
                    telefone: phone,
                    status: 'novo',
                    empresa_id: empresaId
                }])
                .select()
                .single();

            if (insertError) {
                console.error('[WHATSAPP WEBHOOK] Erro ao criar lead:', insertError);
                return NextResponse.json({ message: 'Database error' }, { status: 200 });
            }
            lead = newLead;
        } else if (!isFromMe && pushName && pushName !== lead.nome) {
            // Atualiza nome se mudou no WhatsApp
            await supabase.from('leads').update({ nome: pushName }).eq('id', lead.id);
        }

        // 4. Salvar no Histórico
        await supabase.from('chat_messages').insert([{
            empresa_id: empresaId,
            lead_id: lead.id,
            direction: isFromMe ? 'outbound' : 'inbound',
            content: text,
            message_type: 'text'
        }]);

        if (isFromMe) {
            return NextResponse.json({ message: 'Outbound message persisted' }, { status: 200 });
        }

        // 5. MOTOR DE AUTOMAÇÃO (Abaixo mantemos a lógica original de menus e regras)
        // ==========================================
        // INTERCEPTADOR DE MENUS ATIVOS
        // ==========================================
        const { data: activeMenu } = await supabase
            .from('active_menus')
            .select('*')
            .eq('lead_id', lead.id)
            .maybeSingle();

        if (activeMenu) {
            const { data: rule } = await supabase
                .from('automation_rules')
                .select('flow_data')
                .eq('id', activeMenu.rule_id)
                .single();

            if (rule && rule.flow_data) {
                const nodes = rule.flow_data.nodes || [];
                const edges = rule.flow_data.edges || [];
                const menuNode = nodes.find(n => n.id === activeMenu.node_id);

                if (menuNode) {
                    const buttons = menuNode.data.buttons || [];
                    const replyText = text.trim().toLowerCase();
                    let selectedIndex = -1;

                    const parsedNum = parseInt(replyText);
                    if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= buttons.length) {
                        selectedIndex = parsedNum - 1;
                    } else {
                        selectedIndex = buttons.findIndex(btn => btn.toLowerCase() === replyText);
                    }

                    if (selectedIndex !== -1) {
                        await supabase.from('active_menus').delete().eq('id', activeMenu.id);
                        const sourceHandleId = `btn-${selectedIndex}`;
                        const matchingEdge = edges.find(e => e.source === activeMenu.node_id && e.sourceHandle === sourceHandleId);

                        if (matchingEdge) {
                            const filteredEdges = edges.filter(e => e.source !== activeMenu.node_id || e.id === matchingEdge.id);
                            await executeFlow({
                                nodes, edges: filteredEdges,
                                currentNodeId: activeMenu.node_id,
                                lead, empresaId, ruleId: activeMenu.rule_id,
                                supabase
                            });
                            return NextResponse.json({ message: 'Menu handled' }, { status: 200 });
                        }
                    } else {
                        await supabase.from('active_menus').delete().eq('id', activeMenu.id);
                    }
                }
            }
        }

        // ==========================================
        // MOTOR DE REGRAS (PALAVRAS-CHAVE / STORY / RESPOSTA)
        // ==========================================
        const { data: rules } = await supabase
            .from('automation_rules')
            .select('*')
            .in('trigger_type', ['mensagem_qualquer', 'palavra_chave', 'resposta_story'])
            .eq('is_active', true)
            .eq('empresa_id', empresaId)
            .eq('offset_minutes', 0);

        if (!rules || rules.length === 0) {
            return NextResponse.json({ message: 'Ok: no active rules' }, { status: 200 });
        }

        // Ordenação de prioridade
        const priorityOrder = { 'palavra_chave': 1, 'resposta_story': 2, 'mensagem_qualquer': 3 };
        rules.sort((a, b) => (priorityOrder[a.trigger_type] || 99) - (priorityOrder[b.trigger_type] || 99));

        for (const rule of rules) {
            let deveDisparar = false;
            if (rule.trigger_type === 'mensagem_qualquer') {
                deveDisparar = true;
            } else if (rule.trigger_type === 'palavra_chave' && rule.trigger_keyword) {
                if (text.toLowerCase().includes(rule.trigger_keyword.toLowerCase())) deveDisparar = true;
            }

            if (deveDisparar) {
                const { data: logExistente } = await supabase
                    .from('message_logs')
                    .select('created_at')
                    .eq('rule_id', rule.id)
                    .eq('lead_id', lead.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                let canTrigger = false;
                if (!logExistente || rule.trigger_type === 'palavra_chave') {
                    canTrigger = true;
                } else {
                    const diffMinutes = (new Date() - new Date(logExistente.created_at)) / (1000 * 60);
                    if (diffMinutes >= 30) canTrigger = true;
                }

                if (canTrigger) {
                    let disparou = 0;
                    if (rule.flow_data?.nodes) {
                        const triggerNode = rule.flow_data.nodes.find(n => n.type === 'trigger');
                        if (triggerNode) {
                            disparou = await executeFlow({
                                nodes: rule.flow_data.nodes,
                                edges: rule.flow_data.edges,
                                currentNodeId: triggerNode.id,
                                lead, empresaId, ruleId: rule.id,
                                supabase
                            });
                        }
                    } else if (rule.message_template) {
                        const finalMsg = rule.message_template.replace(/{{nome}}/gi, lead.nome || 'cliente');
                        await sendWhatsAppMessage(phone, finalMsg, empresaId);
                        disparou = 1;
                    }

                    if (disparou > 0) {
                        await supabase.from('message_logs').insert([{
                            rule_id: rule.id, lead_id: lead.id, empresa_id: empresaId, status: 'enviado'
                        }]);
                        break;
                    }
                }
            }
        }

        return NextResponse.json({ message: 'Processamento finalizado.' }, { status: 200 });

    } catch (error) {
        console.error('Erro no Webhook do WhatsApp:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
