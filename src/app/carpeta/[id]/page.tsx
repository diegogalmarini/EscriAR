import { supabase } from "@/lib/supabaseClient";
import { notFound } from "next/navigation";
import FolderWorkspace from "@/components/FolderWorkspace";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CarpetaDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    console.log("🔍 FETCHING CARPETA ID:", id);

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

    if (error) console.error("❌ SUPABASE FETCH ERROR:", error);
    if (!carpeta) console.warn("⚠️ CARPETA NOT FOUND");
    else console.log("✅ CARPETA DATA LOADED, WRITINGS COUNT:", carpeta.escrituras?.length);

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 md:p-10 space-y-6">
            <FolderWorkspace initialData={carpeta} />
        </div>
    );
}
