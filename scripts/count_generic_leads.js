const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function countGenericLeads() {
    console.log('Counting leads with generic names...');
    const { data, count, error } = await supabase
        .from('leads')
        .select('id', { count: 'exact' })
        .like('nome', 'Contato %');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`TOTAL GENERIC LEADS: ${count}`);
}

countGenericLeads();
