import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    if (process.env.NODE_ENV === 'production') {
        console.warn("[supabaseAdmin] Missing credentials in production!");
    }
}

/**
 * Standard Supabase Admin Client.
 * We initialize it at top level but with safe placeholders to prevent build-time crashes.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Helper for dynamic access if needed (optional)
export function getSupabaseAdmin() {
    return supabaseAdmin;
}
