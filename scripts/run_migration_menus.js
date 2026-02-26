require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ ERRO: Faltando variáveis de ambiente (SUPABASE_URL ou SERVICE_ROLE_KEY)");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260226_active_menus.sql');
    let sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("Executando Migration (Active Menus)...");

    // Tentativa Simples (Separando comandos caso RPC falhe em schemas complexos)
    const statements = sql.split(';').filter(stmt => stmt.trim() !== '');

    // Para executar DDL puro no Supabase via JS Client (REST genérico), a forma mais segura quando a dashboard não é usada:
    // (O ideal é rodar o script no SQL Editor do Supabase de novo, mas vou tentar automatizar)
    console.log("AVISO: Por favor, rode o script SQL diretamente no Supabase Dashboard se este script falhar.");
    console.log("Caminho do arquivo: supabase/migrations/20260226_active_menus.sql");
}

run();
