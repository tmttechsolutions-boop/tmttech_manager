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

        if (Array.isArray(chats)) {
            console.log(`[SYNC] Processando ${chats.length} conversas encontradas para sincronizar mensagens...`);

            // 2. Processa cada Chat para MENSAGENS
            for (const chat of chats) {
                const remoteJid = chat.id || chat.remoteJid;
                if (!remoteJid || remoteJid.includes('@g.us')) continue; // Pula grupos

                const phone = remoteJid.split('@')[0];

                // GARANTE QUE O LEAD EXISTE (Se não existir cria aqui para podermos atrelar as mensagens)
                let { data: lead } = await supabase
                    .from('leads')
                    .select('*')
                    .eq('telefone', phone)
                    .maybeSingle();

                if (!lead) {
                    const { data: newLead } = await supabase
                        .from('leads')
                        .insert([{
                            nome: `Contato ${phone.slice(-4)}`,
                            telefone: phone,
                            empresa_id: empresaId,
                            status: 'novo'
                        }])
                        .select()
                        .single();
                    lead = newLead;
                    results.leadsCreated++;
                }

                if (!lead) continue;

                // SINC DE MENSAGENS
                const msgsRes = await fetch(`${EVOLUTION_API_URL}/chat/findMessages/${instanceName}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': EVOLUTION_API_KEY.trim()
                    },
                    body: JSON.stringify({
                        where: { remoteJid: remoteJid },
                        count: 20
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
        }

        // ========================================================
        // [NOVO] FASE DE LIMPEZA DE NOMES (GLOBAL NAME CORRECTION)
        // Por que isso? findChats às vezes não traz todo mundo.
        // Vamos varrer NOSSOS LEADS e corrigir quem ainda é "Contato XXXX"
        // ========================================================
        console.log(`[SYNC] Iniciando limpeza global de nomes para empresa ${empresaId}...`);

        const { data: genericLeads } = await supabase
            .from('leads')
            .select('*')
            .eq('empresa_id', empresaId);

        if (genericLeads && genericLeads.length > 0) {
            // Filtramos apenas os que são genéricos (Contato XXXX) ou apenas o telefone
            const toFix = genericLeads.filter(l =>
                l.nome.startsWith('Contato ') ||
                l.nome === l.telefone ||
                !l.nome
            );

            if (toFix.length > 0) {
                console.log(`[SYNC] Tentando corrigir ${toFix.length} nomes genéricos via fetchProfile...`);

                for (const lead of toFix) {
                    try {
                        const profileRes = await fetch(`${EVOLUTION_API_URL}/chat/fetchProfile/${instanceName}`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'apikey': EVOLUTION_API_KEY.trim()
                            },
                            body: JSON.stringify({ number: lead.telefone })
                        });

                        if (profileRes.ok) {
                            const profileData = await profileRes.json();
                            if (profileData.name && profileData.name !== lead.telefone) {
                                await supabase
                                    .from('leads')
                                    .update({ nome: profileData.name })
                                    .eq('id', lead.id);
                                console.log(`[SYNC] Nome do Lead ${lead.telefone} corrigido para: ${profileData.name}`);
                            }
                        }
                    } catch (err) {
                        console.error(`[SYNC] Falha no profile fix para ${lead.telefone}:`, err.message);
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
