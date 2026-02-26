require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debug() {
    console.log("=== CHECKING ACTIVE MENUS ===");
    const { data: menus } = await supabase.from('active_menus').select('*, leads(nome, telefone)');
    console.log(JSON.stringify(menus, null, 2));

    console.log("\n=== RECENT CHAT MESSAGES ===");
    const { data: msgs } = await supabase.from('chat_messages').select('content, direction, created_at, leads(nome)').order('created_at', { ascending: false }).limit(5);
    console.log(JSON.stringify(msgs, null, 2));
}

debug();
