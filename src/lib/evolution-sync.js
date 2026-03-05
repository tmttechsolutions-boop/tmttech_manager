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

    const supabase = createSupabaseClient(true);
    const results = {
        leadsCreated: 0,
        messagesSynced: 0,
        errors: []
    };

    try {
        console.log(`[SYNC] Iniciando sincronização OTIMIZADA v4 para ${instanceName}...`);

        // 1. Busca lista de Chats do Evolution
        const chatsRes = await fetch(`${EVOLUTION_API_URL}/chat/findChats/${instanceName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY.trim() },
            body: JSON.stringify({ count: 100 })
        });

        if (!chatsRes.ok) throw new Error(`Erro ao buscar chats: ${chatsRes.status}`);

        const chats = await chatsRes.json();
        if (!Array.isArray(chats) || chats.length === 0) {
            console.log("[SYNC] Nenhum chat encontrado na API.");
            return results;
        }

        // 2. FILTRAGEM (Aceita @s.whatsapp.net, @lid e IDs HASHED do Evolution v2)
        const individualChats = chats.filter(chat => {
            const jid = chat.remoteJid || chat.id;
            if (!jid) return false;
            // Ignora grupos explicitamente
            if (jid.includes('@g.us')) return false;
            // Aceita JID padrão, LID ou o formato HASHED (que geralmente começa com 'cmm' e não tem @ no ID principal)
            return jid.includes('@s.whatsapp.net') || jid.includes('@lid') || (!jid.includes('@') && jid.length > 15);
        });

        console.log(`[SYNC] Processando ${individualChats.length} chats individuais.`);

        // Mapeia telefones para evitar duplicados no mesmo lote
        const phonesToJid = new Map();
        individualChats.forEach(chat => {
            const rawId = chat.id;
            const remoteJid = chat.remoteJid || '';

            // Prioriza extrair o telefone real
            let finalPhone = '';
            const lastMsg = chat.lastMessage?.key || {};
            const altPn = (lastMsg.participantAlt || chat.participantAlt || lastMsg.remoteJidAlt || chat.remoteJidAlt || '').split('@')[0];

            if (remoteJid.includes('@s.whatsapp.net')) {
                finalPhone = remoteJid.split('@')[0];
            } else if (altPn && altPn.length > 5) {
                finalPhone = altPn;
            } else if (remoteJid.includes('@lid')) {
                finalPhone = remoteJid.split('@')[0];
            } else if (rawId && !rawId.includes('@')) {
                // Se for hash, e não achamos altPn, usamos o hash como fallback (mas ideal é ter o altPn)
                finalPhone = rawId;
            }

            if (finalPhone) {
                // Se já temos esse telefone e o JID novo for melhor (@s.whatsapp), substitui
                const existingJid = phonesToJid.get(finalPhone);
                if (!existingJid || remoteJid.includes('@s.whatsapp.net')) {
                    phonesToJid.set(finalPhone, remoteJid || rawId);
                }
            }
        });

        const phones = Array.from(phonesToJid.keys());
        console.log(`[SYNC] Telefones identificados: ${phones.length}`);

        // 3. Busca leads existentes (Batch)
        const { data: existingLeads } = await supabase
            .from('leads')
            .select('id, telefone, nome')
            .eq('empresa_id', empresaId)
            .in('telefone', phones);

        const existingPhonesMap = new Map();
        existingLeads?.forEach(l => existingPhonesMap.set(l.telefone, l));

        const leadsToCreate = [];

        individualChats.forEach(chat => {
            const jid = chat.remoteJid || chat.id;
            const phone = jid.split('@')[0];

            if (!existingPhonesMap.has(phone)) {
                leadsToCreate.push({
                    nome: chat.name || chat.pushName || `Contato ${phone.slice(-4)}`,
                    telefone: phone,
                    empresa_id: empresaId,
                    status: 'novo'
                });
                // Marca como existente temporariamente para não criar duplicado se vier 2x no chat
                existingPhonesMap.set(phone, { id: 'temp' });
            }
        });

        // Bulk Insert
        if (leadsToCreate.length > 0) {
            console.log(`[SYNC] Criando ${leadsToCreate.length} novos leads...`);
            const { data: created, error: insErr } = await supabase
                .from('leads')
                .insert(leadsToCreate)
                .select();

            if (!insErr && created) {
                results.leadsCreated = created.length;
                created.forEach(l => existingPhonesMap.set(l.telefone, l));
            } else if (insErr) {
                console.error("[SYNC] Erro ao criar leads:", insErr);
            }
        }

        const allLeads = Array.from(existingPhonesMap.values()).filter(l => l.id !== 'temp');

        // 4. SINCRONIZAÇÃO DE MENSAGENS (Top 40 chats)
        const recentChats = individualChats.slice(0, 40);
        console.log(`[SYNC] Sincronizando mensagens dos ${recentChats.length} chats mais recentes...`);

        for (const chat of recentChats) {
            const rawId = chat.id;
            const remoteJid = chat.remoteJid || '';

            const lastMsg = chat.lastMessage?.key || {};
            const altPn = (lastMsg.participantAlt || chat.participantAlt || lastMsg.remoteJidAlt || chat.remoteJidAlt || '').split('@')[0];

            let phone = '';
            if (remoteJid.includes('@s.whatsapp.net')) phone = remoteJid.split('@')[0];
            else if (altPn) phone = altPn;
            else if (remoteJid.includes('@lid')) phone = remoteJid.split('@')[0];
            else phone = rawId;

            const lead = existingPhonesMap.get(phone);
            if (!lead || lead.id === 'temp') continue;

            const remoteJidForMessages = remoteJid || rawId;

            try {
                const msgsRes = await fetch(`${EVOLUTION_API_URL}/chat/findMessages/${instanceName}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY.trim() },
                    body: JSON.stringify({ where: { remoteJid: remoteJidForMessages }, count: 12 })
                });

                if (msgsRes.ok) {
                    const messages = await msgsRes.json();
                    const messageList = Array.isArray(messages) ? messages : (messages.record || []);

                    const messagesToInsert = [];
                    for (const msg of messageList) {
                        const content = msg.message?.conversation ||
                            msg.message?.extendedTextMessage?.text ||
                            msg.content || "";
                        if (!content) continue;

                        const createdAt = new Date(msg.messageTimestamp * 1000).toISOString();
                        const direction = msg.key?.fromMe ? 'outbound' : 'inbound';

                        // Busca se mensagem já existe no BD
                        const { data: exists } = await supabase
                            .from('chat_messages')
                            .select('id')
                            .eq('lead_id', lead.id)
                            .eq('content', content)
                            .eq('created_at', createdAt)
                            .limit(1);

                        if (!exists || exists.length === 0) {
                            messagesToInsert.push({
                                empresa_id: empresaId,
                                lead_id: lead.id,
                                direction,
                                content,
                                message_type: 'text',
                                created_at: createdAt
                            });
                        }
                    }

                    if (messagesToInsert.length > 0) {
                        const { error: mErr } = await supabase.from('chat_messages').insert(messagesToInsert);
                        if (!mErr) results.messagesSynced += messagesToInsert.length;
                    }
                }
            } catch (err) {
                console.error(`[SYNC] Erro em mensagens para ${phone}:`, err.message);
            }
        }

        return results;

    } catch (error) {
        console.error("[SYNC FATAL ERROR]", error);
        throw error;
    }
}
