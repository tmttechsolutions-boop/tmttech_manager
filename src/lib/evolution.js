import { createSupabaseClient } from './supabase';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE_NAME;

export async function sendWhatsAppMessage(phone, text, empresaId = null) {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
        console.warn("⚠️ Evolution API credentials missing. Simulated dispatch:");
        console.log(`[SIM] To: ${phone} -> ${text}`);
        return { success: true, simulated: true };
    }

    try {
        const supabase = createSupabaseClient();
        let targetEmpresaId = empresaId;
        let customInstance = null;

        if (!targetEmpresaId) {
            const { data: lead } = await supabase.from('leads').select('empresa_id').eq('telefone', phone).maybeSingle();
            if (lead) targetEmpresaId = lead.empresa_id;
        }

        if (targetEmpresaId) {
            const { data: empData } = await supabase.from('empresas').select('whatsapp_instance').eq('id', targetEmpresaId).maybeSingle();
            if (empData?.whatsapp_instance) {
                customInstance = empData.whatsapp_instance;
            }
        }

        const instanceName = customInstance || (targetEmpresaId ? `tmttech_${targetEmpresaId}` : EVOLUTION_INSTANCE);

        if (!instanceName) {
            throw new Error("Could not determine Evolution API instance.");
        }

        const endpoint = `${EVOLUTION_API_URL}/message/sendText/${instanceName}`;
        const cleanPhone = phone.replace(/\D/g, '');

        console.log(`[EVOLUTION] Dispatching to: ${instanceName} | Phone: ${cleanPhone}`);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
                number: cleanPhone,
                options: { delay: 1200, presence: 'composing' },
                textMessage: { text: text }
            })
        });

        const result = await response.json().catch(() => ({ message: 'Invalid JSON response' }));
        console.log(`[EVOLUTION] Result:`, result);

        if (!response.ok) {
            return { success: false, error: result.message || 'Evolution API Error', result };
        }

        // Persist outbound message
        try {
            const { data: lead } = await supabase.from('leads').select('id, empresa_id').eq('telefone', phone).maybeSingle();
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
            console.error("Chat persist error:", dbErr);
        }

        return { success: true, result };

    } catch (error) {
        console.error("WhatsApp dispatch failure:", error);
        return { success: false, error: error.message };
    }
}
