const fs = require('fs');

const envKeys = fs.readFileSync('.env.local', 'utf-8').split('\n').reduce((acc, line) => {
    if (line.includes('=')) {
        const idx = line.indexOf('=');
        acc[line.substring(0, idx).trim()] = line.substring(idx + 1).trim().replace('\r', '');
    }
    return acc;
}, {});

fetch(envKeys.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/leads?select=id,nome,telefone&order=created_at.desc&limit=20', {
    headers: {
        'apikey': envKeys.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': 'Bearer ' + envKeys.SUPABASE_SERVICE_ROLE_KEY
    }
}).then(r => r.json()).then(console.log).catch(console.error);
