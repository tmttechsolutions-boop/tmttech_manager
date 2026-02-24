// Utilitário para conectar o CRM com a sua Evolution API
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE_NAME;

/**
 * Envia uma mensagem de texto simples via WhatsApp usando a Evolution API.
 * @param {string} phone - O número de telefone com DDI (Ex: 5511999999999)
 * @param {string} text - O conteúdo da mensagem
 */
export async function sendWhatsAppMessage(phone, text) {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
        console.warn("⚠️ Chaves da Evolution API não configuradas no .env.local. Disparo Simulado:");
        console.log(`[SIMULAÇÃO WA] Para: ${phone} -> ${text}`);
        return { success: true, simulated: true };
    }

    try {
        const endpoint = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`;
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
