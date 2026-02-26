const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'tmttech_manager';

const targetNumbers = ['553798070486', '553788123971'];

async function verifySyncReach() {
    console.log(`Auditing sync reach for: ${INSTANCE_NAME}`);
    try {
        const response = await fetch(`${EVOLUTION_API_URL}/chat/findChats/${INSTANCE_NAME}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY.trim()
            },
            body: JSON.stringify({ count: 100 })
        });

        const chats = await response.json();
        if (!Array.isArray(chats)) {
            console.log('UNEXPECTED FORMAT:', chats);
            return;
        }

        console.log(`Found ${chats.length} chats.`);

        const found = chats.filter(c => {
            const id = c.id || c.remoteJid || '';
            const num = id.split('@')[0];
            return targetNumbers.includes(num);
        });

        if (found.length === 0) {
            console.log('CRITICAL: Target numbers NOT found in last 100 chats.');
            // Mostra os 10 primeiros para ver o que tem
            console.log('Sample IDs found:', chats.slice(0, 10).map(c => c.id || c.remoteJid));
        } else {
            console.log('Target numbers FOUND:', JSON.stringify(found, null, 2));
        }
    } catch (error) {
        console.error('Audit failed:', error);
    }
}

verifySyncReach();
