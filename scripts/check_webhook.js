const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'tmttech_manager';

async function checkWebhook() {
    console.log(`Checking Webhook for instance: ${INSTANCE_NAME}`);
    try {
        const response = await fetch(`${EVOLUTION_API_URL}/webhook/find/${INSTANCE_NAME}`, {
            headers: {
                'apikey': EVOLUTION_API_KEY.trim()
            }
        });
        const data = await response.json();
        console.log('Webhook Config:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error fetching webhook:', error);
    }
}

checkWebhook();
