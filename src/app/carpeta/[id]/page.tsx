import { createClient } from "@/lib/supabaseServer";
import { notFound, redirect } from "next/navigation";
import FolderWorkspace from "@/components/FolderWorkspace";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CarpetaDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabase = await createClient();

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect("/login");
    }

    // Fetch full hierarchy
    const { data: carpeta, error } = await supabase
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
