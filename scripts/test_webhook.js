const http = require('http');

const postData = JSON.stringify({
    // Simula o payload da Evolution API
    instance: "tmttech_manager",
    data: {
        key: {
            remoteJid: "553788123971@s.whatsapp.net",
            fromMe: false
        },
        pushName: "Thales Martins",
        message: {
            conversation: "1"
        }
    }
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/webhook/whatsapp',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.write(postData);
req.end();
