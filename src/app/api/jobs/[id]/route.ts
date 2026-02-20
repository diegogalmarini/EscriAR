import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const jobId = (await params).id;
        if (!jobId) {
            return NextResponse.json({ error: "Falta ID del trabajo" }, { status: 400 });
        }

        const asyncCookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return asyncCookieStore.get(name)?.value;
                    },
                },
            }
        );

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { data: job, error } = await supabaseAdmin
            .from('ingestion_jobs')
            .select('*')
            .eq('id', jobId)
            .eq('user_id', user.id)
            .single();

        if (error) {
            return NextResponse.json({ error: "Trabajo no encontrado" }, { status: 404 });
        }

        return NextResponse.json({ job });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
