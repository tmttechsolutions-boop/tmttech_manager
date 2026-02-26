const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const phones = ['553798070486', '553788123971'];

async function checkLeads() {
    console.log('Checking leads in database...');
    const { data, error } = await supabase
        .from('leads')
        .select('id, nome, telefone')
        .in('telefone', phones);

    if (error) {
        console.error('Error fetching leads:', error);
        return;
    }

    console.log('LEADS FOUND:', JSON.stringify(data, null, 2));
}

checkLeads();
