const http = require('http');

const URL = 'http://localhost:3000/api/cron/delays';
const INTERVAL_MS = 10000; // 10 segundos para testes ágeis

console.log(`\n================================`);
console.log(`⚙️  [DEV CRON] Inicializado!`);
console.log(`⏱️  Avaliando mensagens atrasadas a cada 10 segundos.`);
console.log(`🔗 Alvo: ${URL}`);
console.log(`⚠️  Este script é apenas para simular o Cron em Homologação/Local.`);
console.log(`================================\n`);

setInterval(() => {
    http.get(URL, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            // Opcional: mostrar as respostas do endpoint. 
            // Comentado para não poluir o terminal, já que o próprio Next.js avisa quando processa algo.
            // console.log(`[DEV CRON] Status: ${res.statusCode} - ${data}`);
        });
    }).on('error', (err) => {
        // Silencia erros de conexão caso o Next.js ainda esteja subindo
        if (err.code !== 'ECONNREFUSED') {
            console.error(`[DEV CRON] Erro: ${err.message}`);
        }
    });
}, INTERVAL_MS);
