const https = require('https');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8').split('\n').reduce((acc, line) => {
    if (line.includes('=')) {
        const [k, ...v] = line.split('=');
        acc[k.trim()] = v.join('=').trim();
    }
    return acc;
}, {});

const EVOLUTION_API_URL = env['EVOLUTION_API_URL'];
const EVOLUTION_API_KEY = env['EVOLUTION_API_KEY'];
const GLOBAL_INSTANCE = env['EVOLUTION_INSTANCE_NAME'] || 'tmttech_manager';

const phone = '5537998070486';
const formattedPhone = phone.includes('@s.whatsapp.net') ? phone : `${phone}@s.whatsapp.net`;

const payload = JSON.stringify({
    number: formattedPhone,
    title: 'Olá, Thiago! ✨\n\nPassando para lembrar do seu agendamento.',
    description: 'Selecione abaixo:',
    footerText: 'Clique numa opção',
    buttons: [
        {
            type: 'reply',
            reply: {
                id: 'ext_ag_confirm_123',
                title: 'Confirmar'
            }
        },
        {
            type: 'reply',
            reply: {
                id: 'ext_ag_reject_123',
                title: 'Rejeitar'
            }
        }
    ]
});

const defaultOptions = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
    }
};

const req = https.request(`${EVOLUTION_API_URL}/message/sendButtons/${GLOBAL_INSTANCE}`, defaultOptions, (res) => {
    let responseBody = '';
    res.on('data', d => responseBody += d);
    res.on('end', () => console.log('STATUS:', res.statusCode, 'BODY:', responseBody));
});

req.on('error', console.error);
req.write(payload);
req.end();
