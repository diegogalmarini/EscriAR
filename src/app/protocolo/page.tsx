import { supabase } from "@/lib/supabaseClient";
import { ProtocoloWorkspace } from "@/components/ProtocoloWorkspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProtocoloPage() {
    // Cargar registros del protocolo del año actual
    const currentYear = new Date().getFullYear();
    const { data: registros, error } = await supabase
        .from("protocolo_registros")
        .select("*")
        .eq("anio", currentYear)
        .order("nro_escritura", { ascending: true });

    if (error) {
        console.error("Error loading protocolo:", error);
    }

    return (
        <div className="p-6 lg:p-8 space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Protocolo</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Registro oficial de escrituras autorizadas — Año {currentYear}
                </p>
            </div>
            <ProtocoloWorkspace registros={registros || []} anio={currentYear} />
        </div>
    );
}
