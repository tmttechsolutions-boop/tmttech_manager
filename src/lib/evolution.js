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

        // Ajuste para Evolution v2: o texto deve ser uma propriedade 'text' direta no objeto
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY.trim(),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({
                number: cleanPhone,
                text: text
            })
        });


        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            console.error(`[EVOLUTION ERROR] Status: ${response.status} | Body:`, result);
            const errorMsg = result.message || result.error || 'Erro na API Evolution';
            return {
                success: false,
                error: response.status === 401 ? 'Não Autorizado (Verifique a API Key no Vercel)' : errorMsg,
                status: response.status
            };
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

/**
 * Envia um menu interativo com botões nativos do WhatsApp (Evolution API v2).
 * ATENÇÃO: O WhatsApp limite o envio de botões a no máximo 3 opções.
 */
export async function sendWhatsAppInteractiveMenu(phone, text, buttonsArray, empresaId = null) {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
        console.warn("⚠️ Evolution API credentials missing. Simulated MENU dispatch:");
        console.log(`[SIM MENU] To: ${phone} -> ${text} | Buttons:`, buttonsArray);
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

        const endpoint = `${EVOLUTION_API_URL}/message/sendButtons/${instanceName}`;
        const cleanPhone = phone.replace(/\D/g, '');

        console.log(`[EVOLUTION BUTTONS] Dispatching to: ${instanceName} | Phone: ${cleanPhone}`);

        // O WhatsApp suporta no MÁXIMO 3 botões por mensagem interativa.
        // Se houver mais, vamos fazer fallback seguro para lista numerada em texto.
        if (buttonsArray.length > 3) {
            console.log(`⚠️ Mais de 3 botões listados. Fallback para lista de texto.`);
            let fallbackMenuText = text + '\n\n';
            buttonsArray.forEach((btn, idx) => {
                fallbackMenuText += `${idx + 1} - ${btn}\n`;
            });
            return await sendWhatsAppMessage(phone, fallbackMenuText, targetEmpresaId);
        }

        // Formata os botões para o padrão da Evolution API
        const formattedButtons = buttonsArray.map((btnTitle, index) => ({
            type: "reply",
            reply: {
                id: `btn-${index}`, // Usamos o mesmo ID de sourceHandle para facilitar a busca, mas nem precisamos validar isso depois
                title: btnTitle.substring(0, 20) // whatsapp limita a string grande, limitando a 20 pra evitar erros
            }
        }));

        const payload = {
            number: cleanPhone,
            options: {
                delay: 1200,
                presence: "composing"
            },
            title: text, // Evolution v2 uses these top-level properties often
            description: "Selecione uma das opções abaixo:",
            footerText: "Clique em uma opção",
            buttons: formattedButtons
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY.trim(),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: JSON.stringify(payload)
        });


        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            console.error(`[EVOLUTION ERROR] Status: ${response.status} | Body:`, result);
            const errorMsg = result.message || result.error || 'Erro na API Evolution no Envio de Botões';
            return {
                success: false,
                error: response.status === 401 ? 'Não Autorizado (Verifique a API Key)' : errorMsg,
                status: response.status
            };
        }

        // Persist outbound message (para o Log do Chat) - Mostramos o texto e as opções de botões num único balão textual
        try {
            const { data: lead } = await supabase.from('leads').select('id, empresa_id').eq('telefone', phone).maybeSingle();
            if (lead) {
                const chatLog = `${text}\n[Botões: ${buttonsArray.join(' | ')}]`;
                await supabase.from('chat_messages').insert([{
                    empresa_id: lead.empresa_id,
                    lead_id: lead.id,
                    direction: 'outbound',
                    content: chatLog,
                    message_type: 'buttons' // ou 'text' se a coluna não tiver check constraint
                }]);
            }
        } catch (dbErr) {
            console.error("Chat persist error (buttons):", dbErr);
        }

        return { success: true, result };

    } catch (error) {
        console.error("WhatsApp buttons dispatch failure:", error);
        return { success: false, error: error.message };
    }
}
