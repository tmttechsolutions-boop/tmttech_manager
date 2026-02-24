import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log("Supabase URL is:", supabaseUrl ? "Defined" : "UNDEFINED", supabaseUrl);
console.log("Supabase Anon Key is:", supabaseAnonKey ? "Defined" : "UNDEFINED");

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("URGENT: Supabase env vars are missing!");
}

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    {
        global: {
            fetch: (...args) => fetch(...args),
        },
    }
)
