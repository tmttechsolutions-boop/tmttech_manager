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
        console.log(`[SYNC] Iniciando sincronização OTIMIZADA para ${instanceName}...`);

        // 1. Busca lista de Chats do Evolution
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
        if (!Array.isArray(chats) || chats.length === 0) return results;

        // 2. FILTRAGEM E BATCH DE LEADS
        // Pegamos apenas contatos individuais (não grupos)
        const individualChats = chats.filter(chat => {
            const jid = chat.remoteJid || chat.id;
            return jid && jid.includes('@s.whatsapp.net');
        });

        const phones = individualChats.map(chat => (chat.remoteJid || chat.id).split('@')[0]);

        // Busca todos os leads existentes desta lista em UMA consulta só
        const { data: existingLeads } = await supabase
            .from('leads')
            .select('id, telefone, nome')
            .eq('empresa_id', empresaId)
            .in('telefone', phones);

        const existingPhones = new Set(existingLeads?.map(l => l.telefone) || []);
        const leadsToCreate = [];

        individualChats.forEach(chat => {
            const phone = (chat.id || chat.remoteJid).split('@')[0];
            if (!existingPhones.has(phone)) {
                leadsToCreate.push({
                    nome: chat.name || `Contato ${phone.slice(-4)}`,
                    telefone: phone,
                    empresa_id: empresaId,
                    status: 'novo'
                });
            }
        });

        // Bulk Insert de novos leads
        if (leadsToCreate.length > 0) {
            const { data: created, error: insErr } = await supabase
                .from('leads')
                .insert(leadsToCreate)
                .select();

            if (!insErr && created) {
                results.leadsCreated = created.length;
                // Atualiza a lista de leads locais para o estágio de mensagens
                if (existingLeads) existingLeads.push(...created);
            }
        }

        const allLeads = existingLeads || [];
        const leadMap = new Map(allLeads.map(l => [l.telefone, l]));

        // 3. SINCRONIZAÇÃO DE MENSAGENS (Limitada aos 20 chats mais recentes para evitar timeout)
        // Processar 100 chats com mensagens causaria timeout de 10s na Vercel
        const recentChats = individualChats.slice(0, 20);
        console.log(`[SYNC] Sincronizando mensagens dos ${recentChats.length} chats mais recentes...`);

        for (const chat of recentChats) {
            const remoteJid = chat.remoteJid || chat.id;
            const phone = remoteJid.split('@')[0];
            const lead = leadMap.get(phone);
            if (!lead) continue;

            try {
                const msgsRes = await fetch(`${EVOLUTION_API_URL}/chat/findMessages/${instanceName}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': EVOLUTION_API_KEY.trim()
                    },
                    body: JSON.stringify({ where: { remoteJid }, count: 15 })
                });

                if (msgsRes.ok) {
                    const messages = await msgsRes.json();
                    const messageList = Array.isArray(messages) ? messages : (messages.record || []);

                    const messagesToInsert = [];
                    for (const msg of messageList) {
                        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.content || "";
                        if (!text) continue;

                        const createdAt = new Date(msg.messageTimestamp * 1000).toISOString();
                        const direction = msg.key?.fromMe ? 'outbound' : 'inbound';

                        // Check existence in batch would be better, but for 15 messages a few queries are okay
                        // To be even safer, we could just try to insert and ignore errors if we had a unique constraint
                        const { data: exists } = await supabase
                            .from('chat_messages')
                            .select('id')
                            .eq('lead_id', lead.id)
                            .eq('content', text)
                            .eq('created_at', createdAt)
                            .limit(1);

                        if (!exists || exists.length === 0) {
                            messagesToInsert.push({
                                empresa_id: empresaId,
                                lead_id: lead.id,
                                direction: direction,
                                content: text,
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
                console.error(`[SYNC] Erro ao processar mensagens para ${phone}:`, err.message);
            }
        }

        // 4. LIMPEZA DE NOMES (Opcional e Rápido)
        // Só fazemos para os leads que acabamos de carregar se forem genéricos
        const toFix = allLeads.filter(l => l.nome.startsWith('Contato ')).slice(0, 10);
        if (toFix.length > 0) {
            console.log(`[SYNC] Corrigindo ${toFix.length} nomes genéricos...`);
            await Promise.all(toFix.map(async (lead) => {
                try {
                    const pRes = await fetch(`${EVOLUTION_API_URL}/chat/fetchProfile/${instanceName}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY.trim() },
                        body: JSON.stringify({ number: lead.telefone })
                    });
                    if (pRes.ok) {
                        const pData = await pRes.json();
                        if (pData.name) {
                            await supabase.from('leads').update({ nome: pData.name }).eq('id', lead.id);
                        }
                    }
                } catch (e) { }
            }));
        }

        return results;

    } catch (error) {
        console.error("[SYNC FATAL ERROR]", error);
        throw error;
    }
}
