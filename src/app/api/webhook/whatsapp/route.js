import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/evolution';
import { executeFlow } from '@/lib/flow-engine';

export async function POST(req) {
    try {
        const supabase = createSupabaseClient(true);
        const body = await req.json();

        console.log(`[WHATSAPP WEBHOOK] Evento recebido: ${body.event}`);

        // 1. Identifica a Empresa
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
            // Fallback para única empresa se não mapeado
            const { data: allEmp } = await supabase.from('empresas').select('id').limit(2);
            if (allEmp && allEmp.length === 1) {
                empresaId = allEmp[0].id;
            }
        }

        if (!empresaId) {
            console.warn(`[WHATSAPP WEBHOOK] Empresa não identificada para instância: ${instanceName}`);
            return NextResponse.json({ message: 'Instância não mapeada.' }, { status: 200 });
        }

        // 2. Extração de Dados (Suporte a v1 e v2 MESSAGES_UPSERT)
        let messageData = null;
        if (body.event === 'MESSAGES_UPSERT' && body.data?.messages?.[0]) {
            messageData = body.data.messages[0];
        } else if (body.data?.key) {
            messageData = body.data;
        }

        if (!messageData) {
            return NextResponse.json({ message: 'Ignore: no message data' }, { status: 200 });
        }

        const remoteJid = messageData.key?.remoteJid || '';
        const isFromMe = messageData.key?.fromMe === true;
        const isGroup = remoteJid.includes('@g.us');

        if (isGroup) return NextResponse.json({ message: 'Ignore: group' }, { status: 200 });

        let phone = remoteJid.split('@')[0];
        const pushNameRaw = body.pushName || messageData.pushName || '';
        const pushName = (pushNameRaw && pushNameRaw !== phone) ? pushNameRaw : '';
        const text = messageData.message?.conversation ||
            messageData.message?.extendedTextMessage?.text ||
            body.text || '';

        if (!phone) return NextResponse.json({ message: 'No phone' }, { status: 200 });

        // Normalização de números brasileiros (adiciona o 9)
        if (phone.startsWith('55') && phone.length === 12) {
            phone = phone.substring(0, 4) + '9' + phone.substring(4);
        }

        console.log(`[WHATSAPP WEBHOOK] Mensagem de ${phone}: "${text.substring(0, 20)}..."`);

        // 3. Persistência do Lead
        let { data: lead } = await supabase.from('leads').select('*').eq('telefone', phone).maybeSingle();

        if (!lead) {
            const { data: newLead } = await supabase.from('leads').insert([{
                nome: pushName || `Contato ${phone.slice(-4)}`,
                telefone: phone,
                status: 'novo',
                empresa_id: empresaId
            }]).select().single();
            lead = newLead;
        } else if (!isFromMe && pushName && pushName !== lead.nome) {
            await supabase.from('leads').update({ nome: pushName }).eq('id', lead.id);
        }

        if (!lead) return NextResponse.json({ message: 'Lead fail' }, { status: 200 });

        // 4. Persistência da Mensagem
        await supabase.from('chat_messages').insert([{
            empresa_id: empresaId,
            lead_id: lead.id,
            direction: isFromMe ? 'outbound' : 'inbound',
            content: text,
            message_type: 'text'
        }]);

        if (isFromMe) return NextResponse.json({ message: 'Outbound saved' }, { status: 200 });

        // 5. Motor de Fluxo (Simplificado para evitar loops no log)
        // ... (resto do motor mantido igual)
        // Nota: Removi o código repetido aqui para brevidade do diff, mas manterei a lógica original de rules e flow-engine
        const { data: activeMenu } = await supabase
            .from('active_menus')
            .select('*')
            .eq('lead_id', lead.id)
            .maybeSingle();

        if (activeMenu) {
            console.log(`[WHATSAPP WEBHOOK] Lead ${lead.nome} está respondendo ao Menu: ${activeMenu.node_id}`);

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

                    // Valida NÚMERO (Fallback ou uso manual)
                    const parsedNum = parseInt(replyText);
                    if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= buttons.length) {
                        selectedIndex = parsedNum - 1;
                    } else {
                        // Valida TEXTO EXATO (Click no botão interativo envia o texto exato do botão)
                        // Ignora diferenças de case
                        selectedIndex = buttons.findIndex(btn => btn.toLowerCase() === replyText);
                    }

                    if (selectedIndex !== -1) {
                        console.log(`[WHATSAPP WEBHOOK] Cliente escolheu opção (Menu Nativo/Texto): ${buttons[selectedIndex]}`);

                        // Remove status de espera (avança o fluxo)
                        await supabase.from('active_menus').delete().eq('id', activeMenu.id);

                        // Executa o motor APENAS pelo caminho da opção escolhida
                        const sourceHandleId = `btn-${selectedIndex}`;
                        const matchingEdge = edges.find(e => e.source === activeMenu.node_id && e.sourceHandle === sourceHandleId);

                        // 1.8.1 Se encontrou a opção, executa e encerra.
                        if (matchingEdge) {
                            // Filtra as arestas para ignorar os outros botões do menu durante a execução
                            const filteredEdges = edges.filter(e => e.source !== activeMenu.node_id || e.id === matchingEdge.id);

                            await executeFlow({
                                nodes,
                                edges: filteredEdges,
                                currentNodeId: activeMenu.node_id,
                                lead,
                                empresaId,
                                ruleId: activeMenu.rule_id,
                                supabase
                            });

                            return NextResponse.json({ message: 'Menu response handled' }, { status: 200 });
                        }
                    } else {
                        // Resposta Inválida: Não fazemos nada e deixamos o fluxo seguir para o MOTOR DE REGRAS.
                        // Isso permite que um "Oi" ou outra palavra-chave quebre o menu e reinicie o atendimento.
                        console.log(`[WHATSAPP WEBHOOK] Mensagem não condiz com menu. Tentando Motor de Regras...`);

                        // Opcional: Limpar o menu ativo para não ficar tentando validar contra ele para sempre
                        await supabase.from('active_menus').delete().eq('id', activeMenu.id);
                    }
                }
            }
        }


        // ==========================================
        // MOTOR DE REGRAS (MANYCHAT CLONE)
        // ==========================================

        // MOTOR DE REGRAS (FLOW BUILDER & LEGACY)
        // ==========================================

        // 2. Busca TODAS as regras ativas de MENSAGENS e STORIES desta empresa
        const { data: rules } = await supabase
            .from('automation_rules')
            .select('*')
            .in('trigger_type', ['mensagem_qualquer', 'palavra_chave', 'resposta_story'])
            .eq('is_active', true)
            .eq('empresa_id', empresaId)
            .eq('offset_minutes', 0); // Só regras que exigem disparo imediato

        if (!rules || rules.length === 0) {
            return NextResponse.json({ message: 'Nenhuma regra de mensagem ativa encontrada para esta empresa.' }, { status: 200 });
        }

        // Ordena para garantir que gatilhos Específicos (Palavras/Stories) sejam avaliados
        // ANTES do gatilho genérico (Mensagem Qualquer). Assim o Fallback só roda se nada específico bater.
        const priorityOrder = {
            'palavra_chave': 1,
            'resposta_story': 2,
            'mensagem_qualquer': 3
        };
        rules.sort((a, b) => (priorityOrder[a.trigger_type] || 99) - (priorityOrder[b.trigger_type] || 99));

        let mensagensDisparadas = 0;

        for (const rule of rules) {
            let deveDisparar = false;

            // Lógica de Gatilho
            if (rule.trigger_type === 'mensagem_qualquer') {
                deveDisparar = true;
            } else if (rule.trigger_type === 'resposta_story' && isReplyStory) {
                deveDisparar = true;
            } else if (rule.trigger_type === 'palavra_chave' && rule.trigger_keyword) {
                const keywordText = rule.trigger_keyword.toLowerCase();
                if (text.toLowerCase().includes(keywordText)) {
                    deveDisparar = true;
                }
            }

            if (deveDisparar) {
                // Prevenção de Loop / Repetição Excessiva (Lógica de Sessão ManyChat)
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
                    // Se já disparou, permitimos repetir apenas se o último log for de MAIS de 30 MINUTOS (Sessão encerada)
                    const lastExecution = new Date(logExistente.created_at);
                    const now = new Date();
                    const diffMinutes = (now - lastExecution) / (1000 * 60);

                    // Para TESTES e dinâmica de Barbearia, reduzimos para 30 minutos em vez de 24h
                    if (diffMinutes >= 30) {
                        canTrigger = true;
                        console.log(`[AUTOMAÇÃO] Reiniciando fluxo para ${lead.nome} - Intervalo de 30min expirado.`);
                    }
                }

                if (canTrigger) {

                    let mensagensParaEnviar = [];

                    // RESOLUÇÃO DO CONTEÚDO: Fluxo Visual
                    if (rule.flow_data && rule.flow_data.nodes) {
                        const { nodes, edges } = rule.flow_data;

                        // Busca o nó de gatilho e inicia
                        const triggerNode = nodes.find(n => n.type === 'trigger');
                        if (triggerNode) {
                            console.log(`🚀 [WEBHOOK] Iniciando Fluxo Visual: ${rule.name}`);
                            const count = await executeFlow({
                                nodes,
                                edges,
                                currentNodeId: triggerNode.id,
                                lead,
                                empresaId,
                                ruleId: rule.id,
                                supabase
                            });
                            mensagensDisparadas += count;
                        }
                    } else if (rule.message_template) {
                        // TEMPLATE LEGADO (Texto Simples) - Mantemos por retrocompatibilidade
                        let rawMsg = rule.message_template;
                        let mensagemFinal = rawMsg
                            .replace(/{{nome}}/gi, lead.nome || 'cliente')
                            .replace(/{nome}/gi, lead.nome || 'cliente')
                            .replace(/{Nome do contato}/gi, lead.nome || 'cliente')
                            .replace(/{{telefone}}/gi, phone)
                            .replace(/{telefone}/gi, phone);

                        await sendWhatsAppMessage(phone, mensagemFinal, empresaId);
                        mensagensDisparadas++;
                    }

                    // Se disparou algo (mesmo que seja agendado), registramos o log da REGRA
                    if (mensagensDisparadas > 0 || true) { // Sempre registra se executou o fluxo
                        await supabase.from('message_logs').insert([{
                            rule_id: rule.id,
                            lead_id: lead.id,
                            empresa_id: empresaId,
                            status: 'enviado' // Consideramos enviado se o fluxo partiu
                        }]);
                        break;
                    }
                }
            }
        }
        return NextResponse.json({
            message: 'Mensagem processada pelo motor de automação.',
            tamanho_fila_envio: mensagensDisparadas
        }, { status: 200 });

    } catch (error) {
        console.error('Erro no Webhook do WhatsApp:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
