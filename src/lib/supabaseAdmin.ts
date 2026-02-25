import { createClient } from '@supabase/supabase-js';

// Internal variable to hold the client instance
let _supabaseAdmin: ReturnType<typeof createClient> | null = null;

/**
 * Get the admin Supabase client, initializing it only when needed.
 * This prevents module-level crashes if environment variables are missing.
 */
export function getSupabaseAdmin() {
    if (_supabaseAdmin) return _supabaseAdmin;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseServiceRoleKey) {
        console.error("[supabaseAdmin] CRITICAL: Missing SUPABASE credentials on server!");
        // We still call createClient so it returns a client that might throw 
        // later when used, but we avoid the top-level crash on IMPORT.
    }

    _supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    return _supabaseAdmin;
}

// Proxy to maintain backward compatibility with 'export const supabaseAdmin'
// while ensuring it's not initialized until accessed.
export const supabaseAdmin = new Proxy({} as any, {
    get: (target, prop, receiver) => {
        const client = getSupabaseAdmin();
        const value = Reflect.get(client, prop, receiver);
        if (typeof value === 'function') {
            return value.bind(client);
        }
        return value;
    }
});
