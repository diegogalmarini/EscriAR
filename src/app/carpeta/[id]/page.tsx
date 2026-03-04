import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notFound, redirect } from "next/navigation";
import FolderWorkspace from "@/components/FolderWorkspace";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CarpetaDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // Verify user is authenticated via server client (has cookies)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect("/login");
    }

    // Fetch full hierarchy using admin client (server-side only, bypasses RLS)
    // Safe because we already verified auth above
    const { data: carpeta, error } = await supabaseAdmin
        .from("carpetas")
        .select(`
            *,
            escrituras (
                *,
                inmuebles!inmueble_princ_id (*),
                operaciones (
                    *,
                    participantes_operacion (
                        *,
                        persona:personas (*)
                    )
                )
            )
        `)
        .eq("id", id)
        .single();

    if (error || !carpeta) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-slate-50/50">
            <FolderWorkspace initialData={carpeta} />
        </div>
    );
}
