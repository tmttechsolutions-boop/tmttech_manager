require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPA_URL, SUPA_KEY);

async function run() {
    const { error } = await supabase.from('empresas').update({ whatsapp_instance: 'A751847CC182-46B9-A6BD-E22154EB93AE' }).eq('id', 1);
    if (error) console.error('Error:', error);
    else console.log('Successfully updated DB with new instance name!');
}
run();
