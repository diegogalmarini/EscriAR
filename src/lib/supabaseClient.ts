import { createBrowserClient } from '@supabase/ssr';

let _supabaseClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
    if (_supabaseClient) return _supabaseClient;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseAnonKey) {
        console.error("[supabaseClient] Missing NEXT_PUBLIC_SUPABASE credentials!");
    }

    _supabaseClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
    return _supabaseClient;
}

// Browser Supabase client (Proxy for safe top-level export/import on server/client)
export const supabase = new Proxy({} as any, {
    get: (target, prop, receiver) => {
        const client = getSupabaseBrowserClient();
        return Reflect.get(client, prop, receiver);
    }
});
