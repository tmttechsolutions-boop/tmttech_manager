const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'tmttech_manager';

async function debugAllContacts() {
    console.log(`Fetching ALL contacts for: ${INSTANCE_NAME}`);
    try {
        const response = await fetch(`${EVOLUTION_API_URL}/contact/findContacts/${INSTANCE_NAME}`, {
            method: 'GET',
            headers: {
                'apikey': EVOLUTION_API_KEY.trim()
            }
        });

        const data = await response.json();
        if (!Array.isArray(data)) {
            console.log('UNEXPECTED DATA FORMAT:', data);
            return;
        }

        console.log('ALL CONTACTS DATA (Sample 5):', JSON.stringify(data.slice(0, 5), null, 2));

        const targetNumbers = ['553798070486', '553788123971'];
        const found = data.filter(c => {
            const id = c.id || c.remoteJid || '';
            const num = id.split('@')[0];
            return targetNumbers.includes(num);
        });
        console.log('\nSPECIFIC TARGETS FOUND:', JSON.stringify(found, null, 2));

    } catch (error) {
        console.error('Debug failed:', error);
    }
}

debugAllContacts();
