import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/evolution';
import { executeFlow } from '@/lib/flow-engine';

export async function POST(req) {
    try {
        const supabase = createSupabaseClient(true);
        const body = await req.json();

        // 1. LOG DE DEBUG REMOTO (Sempre tenta capturar o payload)
        try {
            const { data: debugLeads } = await supabase.from('leads').select('id, empresa_id').eq('telefone', 'DEBUG');
            if (debugLeads && debugLeads.length > 0) {
                // Salva para o primeiro que achar
                await supabase.from('chat_messages').insert([{
                    empresa_id: debugLeads[0].empresa_id,
                    lead_id: debugLeads[0].id,
                    direction: 'inbound',
                    content: `PAYLOAD_${body.event || 'unknown'}: ${JSON.stringify(body).substring(0, 3000)}`,
                    message_type: 'text'
                }]);
            }
        } catch (e) { }

        // 2. Extração de Dados da Mensagem
        let messageData = null;
        if (body.data?.messages?.[0]) messageData = body.data.messages[0];
        else if (body.data?.key) messageData = body.data;
        else if (body.key) messageData = body;

        if (!messageData || !messageData.key) {
            return NextResponse.json({ message: 'Ignored: non-message event' }, { status: 200 });
        }

        const remoteJid = messageData.key.remoteJid || '';
        const isFromMe = messageData.key.fromMe === true;
        if (remoteJid.includes('@g.us')) return NextResponse.json({ message: 'Ignore group' }, { status: 200 });

        let rawPhone = remoteJid.split('@')[0];
        if (!rawPhone) return NextResponse.json({ message: 'No phone' }, { status: 200 });

        // 3. Normalização Inteligente (Trata o "9" do Brasil)
        // Criamos variações para buscar no banco (com e sem o 9)
        let phoneVariations = [rawPhone];
        if (rawPhone.startsWith('55') && rawPhone.length === 12) {
            // Se veio SEM o 9, tenta achar COM o 9 também
            phoneVariations.push(rawPhone.substring(0, 4) + '9' + rawPhone.substring(4));
        } else if (rawPhone.startsWith('55') && rawPhone.length === 13) {
            // Se veio COM o 9, tenta achar SEM o 9 também
            phoneVariations.push(rawPhone.substring(0, 4) + rawPhone.substring(5));
        }

        // 4. Identificação da Empresa
        const instanceName = body.instance || body.instanceName || '';
        let empresaId = null;
        const { data: empData } = await supabase.from('empresas').select('id').eq('whatsapp_instance', instanceName).maybeSingle();

        if (empData) empresaId = empData.id;
        else {
            const { data: allEmp } = await supabase.from('empresas').select('id').limit(2);
            if (allEmp && allEmp.length === 1) empresaId = allEmp[0].id;
        }

        if (!empresaId) return NextResponse.json({ message: 'Instance not mapped' }, { status: 200 });

        // 5. Busca do Lead (Tenta as variações)
        let { data: existingLeads } = await supabase
            .from('leads')
            .select('*')
            .in('telefone', phoneVariations)
            .eq('empresa_id', empresaId)
            .order('created_at', { ascending: false });

        let lead = existingLeads?.[0] || null;

        const pushNameRaw = messageData.pushName || body.pushName || "";
        const pushName = (pushNameRaw && pushNameRaw !== rawPhone) ? pushNameRaw : "";

        if (!lead) {
            // Cria novo lead usando o telefone ORIGINAL que veio da API (confiando no WhatsApp)
            const { data: newLead } = await supabase.from('leads').insert([{
                nome: pushName || `Contato ${rawPhone.slice(-4)}`,
                telefone: rawPhone,
                status: 'novo',
                empresa_id: empresaId
            }]).select().single();
            lead = newLead;
        } else if (!isFromMe && pushName && pushName !== lead.nome) {
            await supabase.from('leads').update({ nome: pushName }).eq('id', lead.id);
        }

        if (!lead) return NextResponse.json({ message: 'Lead fail' }, { status: 200 });

        // 6. Persistência da Mensagem
        const text = messageData.message?.conversation ||
            messageData.message?.extendedTextMessage?.text ||
            messageData.message?.buttonsResponseMessage?.selectedButtonId ||
            messageData.content || body.text || "";

        await supabase.from('chat_messages').insert([{
            empresa_id: empresaId,
            lead_id: lead.id,
            direction: isFromMe ? 'outbound' : 'inbound',
            content: text,
            message_type: 'text'
        }]);

        if (isFromMe) return NextResponse.json({ message: 'Outbound saved' }, { status: 200 });

        // 7. MOTOR DE AUTOMAÇÃO (Apenas Inbound)
        // ... (Mantém a lógica de menus e regras abaixo)
        // (Nota: mantendo a lógica de active_menus e automation_rules conforme visto no arquivo)

        // INTERCEPTADOR DE MENUS
        const { data: activeMenu } = await supabase.from('active_menus').select('*').eq('lead_id', lead.id).maybeSingle();
        if (activeMenu) {
            const { data: rule } = await supabase.from('automation_rules').select('flow_data').eq('id', activeMenu.rule_id).single();
            if (rule?.flow_data) {
                const nodes = rule.flow_data.nodes || [];
                const edges = rule.flow_data.edges || [];
                const menuNode = nodes.find(n => n.id === activeMenu.node_id);
                if (menuNode) {
                    const buttons = menuNode.data.buttons || [];
                    const replyText = text.trim().toLowerCase();
                    let selectedIndex = -1;
                    const parsedNum = parseInt(replyText);
                    if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= buttons.length) selectedIndex = parsedNum - 1;
                    else selectedIndex = buttons.findIndex(btn => btn.toLowerCase() === replyText);

                    if (selectedIndex !== -1) {
                        await supabase.from('active_menus').delete().eq('id', activeMenu.id);
                        const matchingEdge = edges.find(e => e.source === activeMenu.node_id && e.sourceHandle === `btn-${selectedIndex}`);
                        if (matchingEdge) {
                            await executeFlow({
                                nodes, edges: edges.filter(e => e.source !== activeMenu.node_id || e.id === matchingEdge.id),
                                currentNodeId: activeMenu.node_id, lead, empresaId, ruleId: activeMenu.rule_id, supabase
                            });
                            return NextResponse.json({ message: 'Menu handled' }, { status: 200 });
                        }
                    } else {
                        await supabase.from('active_menus').delete().eq('id', activeMenu.id);
                    }
                }
            }
        }

        // MOTOR DE REGRAS
        const { data: rules } = await supabase.from('automation_rules').select('*').in('trigger_type', ['mensagem_qualquer', 'palavra_chave', 'resposta_story']).eq('is_active', true).eq('empresa_id', empresaId).eq('offset_minutes', 0);
        if (rules && rules.length > 0) {
            const priorityOrder = { 'palavra_chave': 1, 'resposta_story': 2, 'mensagem_qualquer': 3 };
            rules.sort((a, b) => (priorityOrder[a.trigger_type] || 99) - (priorityOrder[b.trigger_type] || 99));

            for (const rule of rules) {
                let deveDisparar = false;
                if (rule.trigger_type === 'mensagem_qualquer') deveDisparar = true;
                else if (rule.trigger_type === 'palavra_chave' && text.toLowerCase().includes(rule.trigger_keyword?.toLowerCase())) deveDisparar = true;

                if (deveDisparar) {
                    const { data: log } = await supabase.from('message_logs').select('created_at').eq('rule_id', rule.id).eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
                    if (!log || rule.trigger_type === 'palavra_chave' || ((new Date() - new Date(log.created_at)) / 60000 >= 30)) {
                        let count = 0;
                        if (rule.flow_data?.nodes) {
                            const startNode = rule.flow_data.nodes.find(n => n.type === 'trigger');
                            if (startNode) count = await executeFlow({ nodes: rule.flow_data.nodes, edges: rule.flow_data.edges, currentNodeId: startNode.id, lead, empresaId, ruleId: rule.id, supabase });
                        } else if (rule.message_template) {
                            await sendWhatsAppMessage(rawPhone, rule.message_template.replace(/{{nome}}/gi, lead.nome), empresaId);
                            count = 1;
                        }
                        if (count > 0) {
                            await supabase.from('message_logs').insert([{ rule_id: rule.id, lead_id: lead.id, empresa_id: empresaId, status: 'enviado' }]);
                            break;
                        }
                    }
                }
            }
        }

        return NextResponse.json({ message: 'Processed' }, { status: 200 });

    } catch (error) {
        console.error('Webhook Critical Error:', error);
        return NextResponse.json({ error: error.message }, { status: 200 }); // Retorna 200 para evitar retries da Evolution
    }
}
