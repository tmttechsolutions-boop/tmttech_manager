// Utilitário para conectar o CRM com a sua Evolution API
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE_NAME;

/**
 * Envia uma mensagem de texto simples via WhatsApp usando a Evolution API.
 * @param {string} phone - O número de telefone com DDI (Ex: 5511999999999)
 * @param {string} text - O conteúdo da mensagem
 * @param {string} empresaId - O ID da empresa para identificar a instância (OPCIONAL se vier via DB)
 */
export async function sendWhatsAppMessage(phone, text, empresaId = null) {
    // Se não passar empresaId, tentamos pegar do lead no banco depois, 
    // mas para o endpoint inicial precisamos de um nome de instância.

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
        console.warn("⚠️ Chaves da Evolution API não configuradas no .env.local. Disparo Simulado:");
        console.log(`[SIMULAÇÃO WA] Para: ${phone} -> ${text}`);
        return { success: true, simulated: true };
    }

    try {
        const { createSupabaseClient } = require('./supabase');
        const supabase = createSupabaseClient();

        let targetEmpresaId = empresaId;
        let customInstance = null;

        // Se o empresaId não foi passado, buscamos no lead pelo telefone
        if (!targetEmpresaId) {
            const { data: lead } = await supabase.from('leads').select('empresa_id').eq('telefone', phone).single();
            if (lead) targetEmpresaId = lead.empresa_id;
        }

        // Busca se existe um nome de instância personalizado no banco para esta empresa
        if (targetEmpresaId) {
            const { data: empData } = await supabase.from('empresas').select('whatsapp_instance').eq('id', targetEmpresaId).single();
            if (empData?.whatsapp_instance) {
                customInstance = empData.whatsapp_instance;
            }
        }

        // Ordem de prioridade:
        // 1. Instância customizada no banco (whatsapp_instance)
        // 2. Novo padrão tmttech_{id}
        // 3. Antigo padrão global do .env
        const instanceName = customInstance || (targetEmpresaId ? `tmttech_${targetEmpresaId}` : EVOLUTION_INSTANCE);

        if (!instanceName) {
            throw new Error("Não foi possível determinar a instância da Evolution API.");
        }

        const endpoint = `${EVOLUTION_API_URL}/message/sendText/${instanceName}`;
        // A Evolution API geralmente exige que o número tenha a formatação correta.
        const cleanPhone = phone.replace(/\D/g, '');

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
                number: cleanPhone,
                options: {
                    delay: 1200,
                    presence: 'composing'
                },
                textMessage: { text: text }
            })
        });

        const result = await response.json();

        // 🟢 PERSISTÊNCIA: Salva no histórico de conversa (Outbound)
        // Importamos dinamicamente para evitar ciclos ou problemas de inicialização
        try {
            const { createSupabaseClient } = require('./supabase');
            const supabase = createSupabaseClient();

            // Tenta achar o lead pelo telefone para vincular
            const { data: lead } = await supabase.from('leads').select('id, empresa_id').eq('telefone', phone).single();

            if (lead) {
                await supabase.from('chat_messages').insert([{
                    empresa_id: lead.empresa_id,
                    lead_id: lead.id,
                    direction: 'outbound',
                    content: text,
                    message_type: 'text'
                }]);
            }
        } catch (dbErr) {
            console.error("Erro ao registrar log de chat outbound:", dbErr);
        }

        return { success: true, result };

    } catch (error) {
        console.error("Falha ao enviar mensagem do WhatsApp:", error);
        return { success: false, error: error.message };
    }
}
