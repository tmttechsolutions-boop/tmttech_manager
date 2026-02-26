const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'tmttech_manager';

async function debugChats() {
    console.log(`Fetching chats for: ${INSTANCE_NAME}`);
    try {
        const response = await fetch(`${EVOLUTION_API_URL}/chat/findChats/${INSTANCE_NAME}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY.trim()
            },
            body: JSON.stringify({ count: 10 })
        });

        const data = await response.json();
        console.log('RAW CHATS DATA:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Debug failed:', error);
    }
}

debugChats();
