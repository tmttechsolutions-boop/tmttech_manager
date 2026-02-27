import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/evolution';
import { executeFlow } from '@/lib/flow-engine';
// Importando a API Real

// Esta rota será chamada pela Evolution API ou pela API Oficial do WhatsApp
// Sempre que uma nova mensagem de um cliente chegar no seu número
export async function POST(req) {
    try {
        const supabase = createSupabaseClient(true); // Admin mode para ignorar RLS no webhook
        const data = await req.json();

        // 1. Identifica a Empresa através do nome da Instância
        const instanceName = data.instance || data.instanceName || '';
        let empresaId = null;

        // Tenta buscar a empresa que possui este nome de instância configurado
        const { data: empData } = await supabase
            .from('empresas')
            .select('id')
            .eq('whatsapp_instance', instanceName)
            .maybeSingle();

        if (empData) {
            empresaId = empData.id;
        } else {
            // FALLBACK 1: Tenta padrão tmttech_{ID}
            if (instanceName.startsWith('tmttech_')) {
                const potentialId = instanceName.split('_')[1];
                if (potentialId && potentialId.length > 20) {
                    empresaId = potentialId;
                }
            }

            // FALLBACK 2: Se ainda não achou, pega a PRIMEIRA empresa do banco (se houver apenas uma)
            // Isso garante que para instalações simples, o webhook nunca "perca" a mensagem
            if (!empresaId) {
                const { data: allEmp } = await supabase.from('empresas').select('id').limit(2);
                if (allEmp && allEmp.length === 1) {
                    empresaId = allEmp[0].id;
                    console.log(`[WHATSAPP WEBHOOK] Usando fallback para única empresa cadastrada: ${empresaId}`);
                }
            }
        }

        if (!empresaId) {
            console.warn(`[WHATSAPP WEBHOOK] Instância "${instanceName}" não identificada. Payload:`, JSON.stringify(data).substring(0, 200));
            return NextResponse.json({ message: 'Instância não mapeada.' }, { status: 200 });
        }
        // 2. Extrai dados básicos
        const remoteJid = data.data?.key?.remoteJid || '';
        const isFromMe = data.data?.key?.fromMe === true;
        const isGroup = remoteJid.includes('@g.us');

        const phone = remoteJid.split('@')[0] || data.phone || '';

        // Extração de Nome mais Robusta (Evolution v2)
        const pushNameRaw = data.pushName || data.data?.pushName || data.data?.message?.pushName || '';

        // Se o pushName for igual ao número, consideramos que não temos o nome real ainda
        const pushName = (pushNameRaw && pushNameRaw !== phone) ? pushNameRaw : '';

        const text = data.data?.message?.conversation || data.data?.message?.extendedTextMessage?.text || data.text || '';
        const isReplyStory = data.type === 'story_reply' || data.data?.message?.extendedTextMessage?.contextInfo?.isForwarded === false;
        const buttonId = data.data?.message?.buttonsResponseMessage?.selectedButtonId || '';

        // FILTRO: Ignora mensagens de grupos para não poluir o CRM
        if (isGroup) {
            return NextResponse.json({ message: 'Ignore: group message' }, { status: 200 });
        }

        if (!phone && !buttonId) {
            return NextResponse.json({ message: 'Mensagem vazia ou sem remetente ou é um evento interno ignorado.' }, { status: 200 });
        }

        console.log(`[WHATSAPP WEBHOOK] Processando mensagem de "${pushName}" (${phone}) (buttonId: ${buttonId}): "${text.substring(0, 30)}..."`);

        // 1. Tenta achar quem é esse lead no banco.
        let { data: lead } = await supabase
            .from('leads')
            .select('*')
            .eq('telefone', phone)
            .maybeSingle();

        // [INTERCEPTADOR DE AGENDAMENTO]
        if (buttonId.startsWith('ag_')) {
            const [_, action, agId] = buttonId.split('_'); // ag_confirm_ID ou ag_reject_ID
            console.log(`[WHATSAPP WEBHOOK] Interceptando resposta de agendamento: ${action} para ID ${agId}`);

            if (action === 'confirm' || action === 'reject') {
                const newStatus = action === 'confirm' ? 'confirmado' : 'cancelado';
                const { error: upError } = await supabase
                    .from('agendamentos')
                    .update({ status: newStatus })
                    .eq('id', agId);

                if (!upError) {
                    const responseMsg = action === 'confirm'
                        ? '✅ Seu agendamento foi confirmado com sucesso! Te esperamos aqui.'
                        : '❌ Agendamento cancelado. Se precisar marcar outro horário, estamos à disposição.';
                    await sendWhatsAppMessage(phone, responseMsg, empresaId);
                }

                return NextResponse.json({ message: `Appointment ${action} processed` });
            }
        }

        // Se o lead não existe, cadastra ele automaticamente como novo!
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
                console.error('[WHATSAPP WEBHOOK] Erro ao criar novo lead:', insertError);
                return NextResponse.json({ message: 'Falha ao processar novo contato.' }, { status: 200 });
            }
            lead = newLead;
        } else if (pushName && lead.nome.startsWith('Contato ')) {
            // Pequena melhoria: se o lead já existia mas com nome genérico, e agora temos o pushName, atualiza!
            const { data: updatedLead } = await supabase
                .from('leads')
                .update({ nome: pushName })
                .eq('id', lead.id)
                .select()
                .single();
            if (updatedLead) lead = updatedLead;
        }

        if (!lead) {
            console.error('[WHATSAPP WEBHOOK] Lead não encontrado e falha na criação.');
            return NextResponse.json({ message: 'Lead não identificado.' }, { status: 200 });
        }

        // 3. PERSISTÊNCIA: Salva esta mensagem no histórico de CHAT (Visível na UI de Chat)
        // Se for 'fromMe', a direção é 'outbound'. Se não, é 'inbound'.
        await supabase.from('chat_messages').insert([{
            empresa_id: empresaId,
            lead_id: lead.id,
            direction: isFromMe ? 'outbound' : 'inbound',
            content: text,
            message_type: 'text'
        }]);

        // SEGURANÇA: Se a mensagem foi enviada POR NÓS (fromMe), paramos aqui.
        // Não queremos que o bot responda a si mesmo (evita loop infinito).
        if (isFromMe) {
            return NextResponse.json({ message: 'Persisted outbound message from phone' }, { status: 200 });
        }

        // ==========================================
        // INTERCEPTADOR DE MENUS ATIVOS (Respostas)
        // ==========================================
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
