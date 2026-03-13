import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

/**
 * Standard Supabase Browser Client.
 * Uses default PKCE flow for SSR compatibility with NextJS.
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// Helper for dynamic access if needed (optional)
export function getSupabaseBrowserClient() {
    return supabase;
}
