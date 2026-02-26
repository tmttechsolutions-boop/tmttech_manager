const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'tmttech_manager';

const number = '553798070486';

async function testEndpoints() {
    console.log(`Testing endpoints for: ${number} on instance ${INSTANCE_NAME}`);

    // Lista de possíveis endpoints na v2
    const tests = [
        { url: `${EVOLUTION_API_URL}/contact/profile/${INSTANCE_NAME}?number=${number}`, method: 'GET' },
        { url: `${EVOLUTION_API_URL}/contact/findOne/${INSTANCE_NAME}?number=${number}`, method: 'GET' },
        { url: `${EVOLUTION_API_URL}/chat/getContact/${INSTANCE_NAME}?number=${number}`, method: 'GET' },
        { url: `${EVOLUTION_API_URL}/contact/profile/${INSTANCE_NAME}`, method: 'POST', body: { number } }
    ];

    for (const test of tests) {
        console.log(`\n--- Testing ${test.method} ${test.url} ---`);
        try {
            const options = {
                method: test.method,
                headers: {
                    'apikey': EVOLUTION_API_KEY.trim(),
                    'Content-Type': 'application/json'
                }
            };
            if (test.body) options.body = JSON.stringify(test.body);

            const res = await fetch(test.url, options);
            const data = await res.json().catch(() => 'NOT JSON');
            console.log(`Status: ${res.status}`);
            console.log('Response:', JSON.stringify(data, null, 2));
        } catch (err) {
            console.log(`Error: ${err.message}`);
        }
    }
}

testEndpoints();
