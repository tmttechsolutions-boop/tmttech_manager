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
        // Garantimos que seja apenas números.
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
                    delay: 1200, // Um pequeno delay (1.2s) para a mensagem parecer mais humana
                    presence: 'composing' // Mostra "digitando..." antes de enviar
                },
                textMessage: {
                    text: text
                }
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            console.error("Erro Evolution API:", errData);
            throw new Error(`Falha no disparo: ${response.status}`);
        }

        const result = await response.json();
        return { success: true, result };

    } catch (error) {
        console.error("Falha ao enviar mensagem do WhatsApp:", error);
        return { success: false, error: error.message };
    }
}
