"use server";

import { createClient } from "@/lib/supabaseServer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function runDiag() {
    const results: any = {
        timestamp: new Date().toISOString(),
        env: {
            NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            VERCEL_ENV: process.env.VERCEL_ENV || 'local',
        },
        checks: {}
    };

    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        results.checks.auth = { success: true, userEmail: user?.email || 'not-logged-in' };
    } catch (err: any) {
        results.checks.auth = { success: false, error: err.message };
    }

    try {
        const admin = getSupabaseAdmin();
        const { data, error } = await admin.from('user_profiles').select('count', { count: 'exact', head: true });
        if (error) throw error;
        results.checks.adminClient = { success: true, count: data };
    } catch (err: any) {
        results.checks.adminClient = { success: false, error: err.message };
    }

    return results;
}
