import { createClient } from '@/lib/supabaseServer';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
    if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    try {
        const cookieStore = await cookies();
        const allCookies = cookieStore.getAll().map((c: any) => ({ name: c.name, value: c.name.includes('token') ? '[REDACTED]' : c.value }));

        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            status: 'ok',
            cookies_found: allCookies.length,
            cookies: allCookies,
            user: user ? {
                id: user.id,
                email: user.email,
                aud: user.aud,
                role: user.role
            } : null,
            session_active: !!session,
            errors: {
                user: userError?.message,
                session: sessionError?.message
            },
            env: {
                url_configured: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
                anon_key_configured: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
                node_env: process.env.NODE_ENV
            }
        });
    } catch (e: any) {
        return NextResponse.json({ status: 'error', message: e.message }, { status: 500 });
    }
}
