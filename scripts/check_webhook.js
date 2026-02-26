require('dotenv').config({ path: '.env.local' });

async function checkWebhook() {
    const url = process.env.EVOLUTION_API_URL + '/webhook/find/tmttech_manager';
    try {
        const res = await fetch(url, { headers: { apikey: process.env.EVOLUTION_API_KEY } });
        const data = await res.json();
        console.log("Webhook configuration for tmttech_manager:");
        console.log(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Error fetching webhook:", err);
    }
}

checkWebhook();
