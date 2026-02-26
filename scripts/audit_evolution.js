const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = (process.env.EVOLUTION_API_KEY || '').trim();

async function audit() {
    console.log(`URL: ${EVOLUTION_API_URL}`);
    console.log(`KEY starts with: ${EVOLUTION_API_KEY.substring(0, 5)}...`);

    try {
        console.log('\n--- FETCHING INSTANCES ---');
        const res = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
            headers: { 'apikey': EVOLUTION_API_KEY }
        });
        const instances = await res.json();
        console.log('Instances:', JSON.stringify(instances, null, 2));

        if (Array.isArray(instances)) {
            for (const inst of instances) {
                console.log(`\n--- WEBHOOK FOR ${inst.instanceName} ---`);
                const wRes = await fetch(`${EVOLUTION_API_URL}/webhook/find/${inst.instanceName}`, {
                    headers: { 'apikey': EVOLUTION_API_KEY }
                });
                const wData = await wRes.json();
                console.log(JSON.stringify(wData, null, 2));
            }
        }
    } catch (e) {
        console.error('Audit failed:', e);
    }
}

audit();
