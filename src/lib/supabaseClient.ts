import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

/**
 * Standard Supabase Browser Client.
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        flowType: 'implicit',
    },
});

// Helper for dynamic access if needed (optional)
export function getSupabaseBrowserClient() {
    return supabase;
}
