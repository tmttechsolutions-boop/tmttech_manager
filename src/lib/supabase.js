import { createClient } from '@supabase/supabase-js'

export function createSupabaseClient(admin = false) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    // Se for admin (server-side), usa a SERVICE_ROLE_KEY para ignorar RLS
    // Caso contrário, usa a ANON_KEY normal.
    const key = (admin && typeof window === 'undefined')
        ? (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
        : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    return createClient(
        supabaseUrl,
        key,
        {
            global: {
                fetch: (...args) => fetch(...args),
            },
        }
    );
}
