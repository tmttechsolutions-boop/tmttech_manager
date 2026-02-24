import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/evolution'; // Importando a API Real

// Esta rota será chamada pela Evolution API ou pela API Oficial do WhatsApp
// Sempre que uma nova mensagem de um cliente chegar no seu número
export async function POST(req) {
    try {
        const supabase = createSupabaseClient();
        const data = await req.json();

        // Supondo uma estrutura genérica ou da Evolution API
        const phone = data.phone || data.remoteJid?.split('@')[0];
        const text = data.text || data.message?.conversation || data.message?.extendedTextMessage?.text || '';
        const isReplyStory = data.type === 'story_reply' || data.message?.extendedTextMessage?.contextInfo?.isForwarded === false;

        if (!phone || !text) {
            return NextResponse.json({ message: 'Mensagem vazia ou sem remetente ou é um evento interno ignorado.' }, { status: 200 });
        }

        console.log(`[WHATSAPP WEBHOOK] Mensagem Recebida de ${phone}: "${text}"`);

        // 1. Tenta achar quem é esse lead no banco.
        let { data: lead } = await supabase
            .from('leads')
            .select('*')
            .eq('telefone', phone)
            .single();

        // Se o lead não existe, cadastra ele automaticamente como novo!
        if (!lead) {
            const { data: newLead } = await supabase
                .from('leads')
                .insert([{ nome: `Contato ${phone.slice(-4)}`, telefone: phone, status: 'novo' }])
                .select()
                .single();
            lead = newLead;
        }

        // ==========================================
        // MOTOR DE REGRAS (MANYCHAT CLONE)
        // ==========================================

        // 2. Busca TODAS as regras ativas de MENSAGENS e STORIES
        const { data: rules } = await supabase
            .from('automation_rules')
            .select('*')
            .in('trigger_type', ['mensagem_qualquer', 'palavra_chave', 'resposta_story'])
            .eq('is_active', true)
            .eq('offset_minutes', 0); // Só regras que exigem disparo imediato

        if (!rules || rules.length === 0) {
            return NextResponse.json({ message: 'Nenhuma regra de mensagem ativa encontrada.' }, { status: 200 });
        }

        let mensagensDisparadas = 0;

        for (const rule of rules) {
            let deveDisparar = false;

            // Regra 1: Qualquer Mensagem
            if (rule.trigger_type === 'mensagem_qualquer') {
                deveDisparar = true;
            }

            // Regra 2: Resposta a Story
            if (rule.trigger_type === 'resposta_story' && isReplyStory) {
                deveDisparar = true;
            }

            // Regra 3: Palavra Chave Exata
            if (rule.trigger_type === 'palavra_chave' && rule.trigger_keyword) {
                const keywordText = rule.trigger_keyword.toLowerCase();
                const messageText = text.toLowerCase();
                // Verifica se a mensagem CONTÉM a palavra-chave
                if (messageText.includes(keywordText)) {
                    deveDisparar = true;
                }
            }

            // Se o gatilho bateu, disparar!
            if (deveDisparar) {
                // Verifica log
                const { data: logExistente } = await supabase
                    .from('message_logs')
                    .select('id')
                    .eq('rule_id', rule.id)
                    .eq('lead_id', lead.id)
                    .single();

                if (!logExistente || rule.trigger_type === 'palavra_chave') {
                    // Monta a mensagem final
                    let mensagemFinal = rule.message_template
                        .replace('{{nome}}', lead.nome)
                        .replace('{{servico}}', 'seu serviço')
                        .replace('{{hora}}', 'em breve');

                    // AQUI NÓS DISPARAMOS PARA A EVOLUTION API REAL!
                    console.log(`\n================================`);
                    console.log(`🤖 [DISPARO AUTOMÁTICO - REGRA: ${rule.trigger_type}]`);
                    await sendWhatsAppMessage(lead.telefone, mensagemFinal);
                    console.log(`================================\n`);

                    // Registra logs
                    await supabase.from('message_logs').insert([{
                        rule_id: rule.id,
                        lead_id: lead.id,
                        status: 'enviado'
                    }]);

                    mensagensDisparadas++;
                    break;
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
