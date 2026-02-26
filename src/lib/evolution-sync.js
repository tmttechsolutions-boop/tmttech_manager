import { createSupabaseClient } from './supabase';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

/**
 * Sincroniza o histórico de conversas de uma instância específica
 */
export async function syncChatHistory(empresaId, instanceName) {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
        throw new Error("Credenciais da Evolution API não encontradas.");
    }

    const supabase = createSupabaseClient(true); // Admin client
    const results = {
        leadsCreated: 0,
        messagesSynced: 0,
        errors: []
    };

    try {
        console.log(`[SYNC] Iniciando sincronização para ${instanceName}...`);

        // 1. Busca lista de Chats do Evolution
        const chatsRes = await fetch(`${EVOLUTION_API_URL}/chat/findChats/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY.trim()
            },
            body: JSON.stringify({ count: 50 }) // Pega os últimos 50 chats ativos
        });

        if (!chatsRes.ok) {
            throw new Error(`Erro ao buscar chats: ${chatsRes.status}`);
        }

        const chats = await chatsRes.json();

        if (!Array.isArray(chats)) {
            console.log("[SYNC] Nenhum chat encontrado ou formato inválido.", chats);
            return results;
        }

        // 2. Processa cada Chat
        for (const chat of chats) {
            const remoteJid = chat.id || chat.remoteJid;
            if (!remoteJid || remoteJid.includes('@g.us')) continue; // Pula grupos

            const phone = remoteJid.split('@')[0];

            // 2.1 Garante que o Lead existe
            let { data: lead } = await supabase
                .from('leads')
                .select('*')
                .eq('telefone', phone)
                .maybeSingle();

            const realName = chat.name || chat.pushName || "";

            if (!lead) {
                const { data: newLead, error: leadErr } = await supabase
                    .from('leads')
                    .insert([{
                        nome: realName || `Contato ${phone.slice(-4)}`,
                        telefone: phone,
                        empresa_id: empresaId,
                        status: 'novo'
                    }])
                    .select()
                    .single();

                if (leadErr) {
                    results.errors.push(`Erro ao criar lead ${phone}: ${leadErr.message}`);
                    continue;
                }
                lead = newLead;
                results.leadsCreated++;
            } else if (realName && (lead.nome.startsWith('Contato ') || !lead.nome)) {
                // Se o lead já existe mas o nome é genérico, atualiza para o nome real do WhatsApp
                const { data: updatedLead } = await supabase
                    .from('leads')
                    .update({ nome: realName })
                    .eq('id', lead.id)
                    .select()
                    .single();
                if (updatedLead) {
                    lead = updatedLead;
                    console.log(`[SYNC] Nome do Lead ${phone} atualizado para: ${realName}`);
                }
            }

            // 2.2 Busca mensagens desse Chat no Evolution
            const msgsRes = await fetch(`${EVOLUTION_API_URL}/chat/findMessages/${instanceName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': EVOLUTION_API_KEY.trim()
                },
                body: JSON.stringify({
                    where: { remoteJid: remoteJid },
                    count: 30 // Últimas 30 mensagens por chat
                })
            });

            if (!msgsRes.ok) continue;

            const messages = await msgsRes.json();
            const messageList = Array.isArray(messages) ? messages : (messages.record || []);

            // 2.3 Insere mensagens no Supabase (Deduplicando pelo timestamp se possível ou conteúdo)
            for (const msg of messageList) {
                const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.content || "";
                if (!text) continue;

                const createdAt = new Date(msg.messageTimestamp * 1000).toISOString();
                const direction = msg.key?.fromMe ? 'outbound' : 'inbound';

                // Verifica se já existe (busca por lead, conteúdo e data aproximada)
                const { data: exists } = await supabase
                    .from('chat_messages')
                    .select('id')
                    .eq('lead_id', lead.id)
                    .eq('content', text)
                    .limit(1);

                if (!exists || exists.length === 0) {
                    const { error: msgErr } = await supabase
                        .from('chat_messages')
                        .insert([{
                            empresa_id: empresaId,
                            lead_id: lead.id,
                            direction: direction,
                            content: text,
                            message_type: 'text',
                            created_at: createdAt
                        }]);

                    if (!msgErr) results.messagesSynced++;
                }
            }
        }

        return results;

    } catch (error) {
        console.error("[SYNC FATAL ERROR]", error);
        throw error;
    }
}
