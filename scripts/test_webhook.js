// save this as run_webhook_test.js in the root of the CRM project.

// =========================================================================
// SCRIPT PARA TESTAR O WEBHOOK EXTERNO DE AGENDAMENTO SIMULANDO A BARBEARIA
// =========================================================================

// PASSO 1: Cole aqui a URL exata que o CRM de Automações gerou para você
const WEBHOOK_URL = "https://tmttech-manager.vercel.app/api/webhook/custom/SUA_REGRA_ID_AQUI?empresaId=SUA_EMPRESA_ID_AQUI";

// PASSO 2: Crie os dados Fictícios (Mock) que o site da barbearia estaria enviando
const payload = {
    phone: "553788123971", // Seu número para testar
    name: "Thales Martins (Teste Webhook)",
    data: {
        servico: "Corte Sombreado + Barba Lenhador",
        data_agendamento: "Quinta-feira, 26/02 às 18:30",
        barbeiro: "Thiago Silva"
    }
};

async function testarWebhook() {
    console.log(`🚀 Enviando JSON de teste para: ${WEBHOOK_URL}\n`);
    console.log("📦 Payload enviado:\n", JSON.stringify(payload, null, 2), "\n");

    if (WEBHOOK_URL.includes("SUA_REGRA_ID_AQUI")) {
        console.error("❌ ERRO: Você esqueceu de colar a URL gerada pelo CRM no PASSO 1 do script!");
        return;
    }

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json' // O nosso CRM exige requisições em JSON (Padrão web)
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json().catch(() => ({}));

        if (response.ok) {
            console.log("\n✅ SUCESSO! O CRM aceitou a requisição.");
            console.log("Resposta do CRM:", result);
            console.log("👉 Olhe o seu WhatsApp! A automação deve ter sido disparada.");
        } else {
            console.log("\n❌ FALHA! O CRM recusou a requisição HTTP " + response.status);
            console.log("Motivo:", result);
        }

    } catch (error) {
        console.error("\n💥 ERRO CRÍTICO DE REDE: Não foi possível conectar ao Vercel.", error);
    }
}

testarWebhook();
