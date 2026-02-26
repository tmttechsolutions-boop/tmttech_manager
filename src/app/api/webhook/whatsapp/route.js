import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/evolution'; // Importando a API Real

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
        const pushName = data.pushName || data.data?.pushName || '';
        const text = data.data?.message?.conversation || data.data?.message?.extendedTextMessage?.text || data.text || '';
        const isReplyStory = data.type === 'story_reply' || data.data?.message?.extendedTextMessage?.contextInfo?.isForwarded === false;

        // FILTRO: Ignora mensagens de grupos para não poluir o CRM
        if (isGroup) {
            return NextResponse.json({ message: 'Ignore: group message' }, { status: 200 });
        }

        if (!phone || !text) {
            return NextResponse.json({ message: 'Mensagem vazia ou sem remetente ou é um evento interno ignorado.' }, { status: 200 });
        }

        console.log(`[WHATSAPP WEBHOOK] Processando mensagem de "${pushName}" (${phone}) (fromMe: ${isFromMe}): "${text.substring(0, 30)}..."`);

        // 1. Tenta achar quem é esse lead no banco.
        let { data: lead } = await supabase
            .from('leads')
            .select('*')
            .eq('telefone', phone)
            .maybeSingle();

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
        // MOTOR DE REGRAS (MANYCHAT CLONE)
        // ==========================================

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
                // Prevenção de Loop / Repetição Excessiva
                const { data: logExistente } = await supabase
                    .from('message_logs')
                    .select('id')
                    .eq('rule_id', rule.id)
                    .eq('lead_id', lead.id)
                    .single();

                // Permitimos repetir palavra-chave, mas "qualquer mensagem" apenas uma vez por lead (padrão boas vindas)
                if (!logExistente || rule.trigger_type === 'palavra_chave') {

                    let mensagensParaEnviar = [];

                    // RESOLUÇÃO DO CONTEÚDO: Fluxo Visual ou Template Simples
                    if (rule.flow_data && rule.flow_data.nodes) {
                        // MOTOR DE FLUXO VISUAL (React Flow)
                        const nodes = rule.flow_data.nodes;
                        const edges = rule.flow_data.edges || [];

                        // Busca o nó de gatilho
                        const triggerNode = nodes.find(n => n.type === 'trigger');
                        if (triggerNode) {
                            // Encontra conexões de saída do gatilho
                            const connectedEdges = edges.filter(e => e.source === triggerNode.id);
                            for (const edge of connectedEdges) {
                                const targetNode = nodes.find(n => n.id === edge.target);
                                // Se for um nó de ação com mensagem, extrai o texto
                                if (targetNode && targetNode.type === 'action' && targetNode.data?.message) {
                                    mensagensParaEnviar.push(targetNode.data.message);
                                }
                            }
                        }
                    } else if (rule.message_template) {
                        // TEMPLATE LEGADO (Texto Simples)
                        mensagensParaEnviar.push(rule.message_template);
                    }

                    // DISPAROS
                    for (const rawMsg of mensagensParaEnviar) {
                        // SUBSTITUIÇÃO DE VARIÁVEIS ROBUSTA
                        let mensagemFinal = rawMsg
                            .replace(/{{nome}}/g, lead.nome || 'cliente')
                            .replace(/{nome}/g, lead.nome || 'cliente')
                            .replace(/{Nome do contato}/g, lead.nome || 'cliente')
                            .replace(/{{telefone}}/g, phone)
                            .replace(/{telefone}/g, phone);

                        console.log(`🤖 [AUTOMAÇÃO] Disparando para ${phone} via Regra: "${rule.name || rule.trigger_type}"`);
                        const dispatch = await sendWhatsAppMessage(phone, mensagemFinal, empresaId);

                        // Registra log
                        await supabase.from('message_logs').insert([{
                            rule_id: rule.id,
                            lead_id: lead.id,
                            empresa_id: empresaId,
                            status: dispatch.success ? 'enviado' : 'erro',
                            error_message: dispatch.success ? null : (dispatch.error || 'Erro desconhecido')
                        }]);

                        mensagensDisparadas++;
                    }

                    // Se disparou algo, interrompemos para este webhook (evita disparar múltiplas regras pra mesma msg)
                    if (mensagensDisparadas > 0) break;
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
