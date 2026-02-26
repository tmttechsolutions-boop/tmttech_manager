import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: delays, error } = await supabase.from('delayed_messages').select('*').order('created_at', { ascending: false }).limit(10);
    console.log("=== ÚLTIMOS 10 DELAYS NO BANCO ===");
    if (error) console.error(error);
    else console.log(delays);
}

check();
