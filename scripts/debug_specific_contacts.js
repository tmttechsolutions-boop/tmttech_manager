const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'tmttech_manager';

const phones = ['553798070486', '553788123971'];

async function debugSpecificContacts() {
    for (const phone of phones) {
        console.log(`\nChecking contact: ${phone}`);
        try {
            const response = await fetch(`${EVOLUTION_API_URL}/contact/findOne/${INSTANCE_NAME}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': EVOLUTION_API_KEY.trim()
                },
                body: JSON.stringify({ number: phone })
            });

            const data = await response.json();
            console.log(`DATA for ${phone}:`, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error(`Debug failed for ${phone}:`, error);
        }
    }
}

debugSpecificContacts();
