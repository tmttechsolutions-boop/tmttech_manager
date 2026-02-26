const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkEmpresas() {
    console.log('Checking empresas...');
    const { data, error } = await supabase
        .from('empresas')
        .select('id, nome, whatsapp_instance');

    if (error) {
        console.error('Error fetching empresas:', error);
        return;
    }

    console.log('EMPRESAS FOUND:', JSON.stringify(data, null, 2));
}

checkEmpresas();
