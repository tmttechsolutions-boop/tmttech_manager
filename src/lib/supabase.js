import { createClient } from '@supabase/supabase-js'

export function createSupabaseClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

    return createClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            global: {
                fetch: (...args) => fetch(...args),
            },
        }
    );
}
