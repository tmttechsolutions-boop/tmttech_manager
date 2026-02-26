const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
    console.log('--- EMPRESAS ---');
    const { data: emps } = await supabase.from('empresas').select('id, nome, whatsapp_instance');
    console.log(JSON.stringify(emps, null, 2));

    console.log('\n--- RULES ---');
    const { data: rules } = await supabase.from('automation_rules').select('*');
    console.log(JSON.stringify(rules, null, 2));

    console.log('\n--- RECENT LOGS ---');
    const { data: logs } = await supabase.from('message_logs').select('*, leads(nome, telefone), automation_rules(name)').order('created_at', { ascending: false }).limit(10);
    console.log(JSON.stringify(logs, null, 2));

    console.log('\n--- RECENT CHAT MESSAGES ---');
    const { data: chatMsgs } = await supabase.from('chat_messages').select('*, leads(nome, telefone)').order('created_at', { ascending: false }).limit(5);
    console.log(JSON.stringify(chatMsgs, null, 2));
}

check().catch(console.error);
