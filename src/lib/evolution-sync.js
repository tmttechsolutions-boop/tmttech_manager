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
        console.log(`[SYNC] Iniciando sincronização DEEP para ${instanceName}...`);

        // 1. Busca lista de Chats do Evolution (Aumentamos para 100 para pegar mais gente)
        const chatsRes = await fetch(`${EVOLUTION_API_URL}/chat/findChats/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY.trim()
            },
            body: JSON.stringify({ count: 100 })
        });

        if (!chatsRes.ok) {
            throw new Error(`Erro ao buscar chats: ${chatsRes.status}`);
        }

        const chats = await chatsRes.json();

        if (!Array.isArray(chats)) {
            console.log("[SYNC] Nenhum chat encontrado ou formato inválido.", chats);
            return results;
        }

        console.log(`[SYNC] Processando ${chats.length} conversas encontradas...`);

        // 2. Processa cada Chat
        for (const chat of chats) {
            const remoteJid = chat.id || chat.remoteJid;
            if (!remoteJid || remoteJid.includes('@g.us')) continue; // Pula grupos

            const phone = remoteJid.split('@')[0];
            const pushNameRoot = chat.pushName || "";
            const pushNameLast = chat.lastMessage?.pushName || "";

            // Tenta pegar o nome mais "real" possível. 
            let realName = chat.name || "";
            if (!realName || realName === phone) {
                if (pushNameRoot && pushNameRoot !== phone) realName = pushNameRoot;
                else if (pushNameLast && pushNameLast !== phone) realName = pushNameLast;
            }

            // BUSCA O LEAD NO BANCO
            let { data: lead } = await supabase
                .from('leads')
                .select('*')
                .eq('telefone', phone)
                .maybeSingle();

            // CASO ESPECIAL: SE SE O NOME AINDA FOR GENÉRICO, TENTA O FETCHPROFILE (FORÇADO)
            if (!realName || realName === phone || (lead && lead.nome.startsWith('Contato '))) {
                try {
                    const profileRes = await fetch(`${EVOLUTION_API_URL}/chat/fetchProfile/${instanceName}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': EVOLUTION_API_KEY.trim()
                        },
                        body: JSON.stringify({ number: phone })
                    });
                    if (profileRes.ok) {
                        const profileData = await profileRes.json();
                        if (profileData.name && profileData.name !== phone) {
                            realName = profileData.name;
                        }
                    }
                } catch (err) {
                    console.error(`[SYNC] Erro no fetchProfile para ${phone}:`, err.message);
                }
            }

            // GARANTE O LEAD
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
            } else if (realName && (lead.nome.startsWith('Contato ') || lead.nome === phone || !lead.nome)) {
                // Atualização Retroativa de Nome!
                const { data: updatedLead } = await supabase
                    .from('leads')
                    .update({ nome: realName })
                    .eq('id', lead.id)
                    .select()
                    .single();
                if (updatedLead) {
                    lead = updatedLead;
                    console.log(`[SYNC] Nome corrigido de ${phone} para: ${realName}`);
                }
            }

            // 3. SINC DE MENSAGENS (Processamos se tivermos o lead)
            const msgsRes = await fetch(`${EVOLUTION_API_URL}/chat/findMessages/${instanceName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': EVOLUTION_API_KEY.trim()
                },
                body: JSON.stringify({
                    where: { remoteJid: remoteJid },
                    count: 20 // Pegamos as últimas 20 mensagens
                })
            });

            if (msgsRes.ok) {
                const messages = await msgsRes.json();
                const messageList = Array.isArray(messages) ? messages : (messages.record || []);

                for (const msg of messageList) {
                    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.content || "";
                    if (!text) continue;

                    const createdAt = new Date(msg.messageTimestamp * 1000).toISOString();
                    const direction = msg.key?.fromMe ? 'outbound' : 'inbound';

                    // Deduplicação básica
                    const { data: exists } = await supabase
                        .from('chat_messages')
                        .select('id')
                        .eq('lead_id', lead.id)
                        .eq('content', text)
                        .eq('direction', direction)
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
        }
        return results;

    } catch (error) {
        console.error("[SYNC FATAL ERROR]", error);
        throw error;
    }
}
