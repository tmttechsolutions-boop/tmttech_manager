const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'tmttech_manager';

const number = '553798070486';

async function testFetchProfile() {
    console.log(`Testing /chat/fetchProfile for: ${number} on instance ${INSTANCE_NAME}`);

    try {
        const response = await fetch(`${EVOLUTION_API_URL}/chat/fetchProfile/${INSTANCE_NAME}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY.trim()
            },
            body: JSON.stringify({ number })
        });

        const data = await response.json().catch(() => 'NOT JSON');
        console.log(`Status: ${response.status}`);
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.log(`Error: ${err.message}`);
    }
}

testFetchProfile();
