require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debugTimeline() {
    console.log("=== RECENT DELAYED MESSAGES ===");
    const { data: delays } = await supabase.from('delayed_messages').select('*').order('created_at', { ascending: false }).limit(5);
    console.log(JSON.stringify(delays, null, 2));

    console.log("\n=== RECENT MESSAGE LOGS (TRIGGERS) ===");
    const { data: logs } = await supabase.from('message_logs').select('*').order('created_at', { ascending: false }).limit(5);
    console.log(JSON.stringify(logs, null, 2));

    console.log("\n=== RECENT CHAT MESSAGES ===");
    const { data: chats } = await supabase.from('chat_messages').select('content, direction, created_at').order('created_at', { ascending: false }).limit(10);
    console.log(JSON.stringify(chats, null, 2));
}

debugTimeline();
