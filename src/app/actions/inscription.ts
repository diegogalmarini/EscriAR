"use server";

import { createClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import { publishToProtocolo } from "@/app/actions/protocolo";

/**
 * Mark a deed as signed and calculate the inscription deadline (45 days)
 */
export async function markAsSigned(escrituraId: string, fechaFirma: string) {
    try {
        const supabase = await createClient();
        const firmaDate = new Date(fechaFirma);

        // Calculate deadline: 45 calendar days from signature date
        const vencimientoDate = new Date(firmaDate);
        vencimientoDate.setDate(vencimientoDate.getDate() + 45);

        // Get the folder ID to update its status
        const { data: escritura } = await supabase
            .from("escrituras")
            .select("carpeta_id")
            .eq("id", escrituraId)
            .single();

        if (!escritura) throw new Error("Escritura not found");

        // Update the deed
        const { error: escrituraError } = await supabase
            .from("escrituras")
            .update({
                fecha_firma_real: fechaFirma,
                fecha_vencimiento_inscripcion: vencimientoDate.toISOString().split('T')[0],
                estado_inscripcion: "PENDIENTE"
            })
            .eq("id", escrituraId);

        if (escrituraError) throw escrituraError;

        // Update folder status to FIRMADA
        const { error: carpetaError } = await supabase
            .from("carpetas")
            .update({ estado: "FIRMADA" })
            .eq("id", escritura.carpeta_id);

        if (carpetaError) throw carpetaError;

        // ET7.1: Publicar automáticamente en protocolo al firmar
        publishToProtocolo(escritura.carpeta_id).catch((err) =>
            console.error("[markAsSigned] Error publicando en protocolo:", err)
        );

        revalidatePath("/dashboard");
        revalidatePath(`/carpeta/${escritura.carpeta_id}`);

        return {
            success: true,
            vencimiento: vencimientoDate.toISOString().split('T')[0]
        };
    } catch (error: any) {
        console.error("Error marking as signed:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Update registry status and entry number
 */
export async function updateRegistryStatus(
    escrituraId: string,
    status: "PENDIENTE" | "INGRESADA" | "OBSERVADA" | "INSCRIPTA" | "RETIRADA",
    nroEntrada?: string
) {
    try {
        const supabase = await createClient();
        const updateData: any = { estado_inscripcion: status };

        if (nroEntrada) {
            updateData.nro_entrada_registro = nroEntrada;
        }

        const { error } = await supabase
            .from("escrituras")
            .update(updateData)
            .eq("id", escrituraId);

        if (error) throw error;

        // Get carpeta_id for revalidation
        const { data: escritura } = await supabase
            .from("escrituras")
            .select("carpeta_id")
            .eq("id", escrituraId)
            .single();

        if (escritura) {
            revalidatePath("/dashboard");
            revalidatePath(`/carpeta/${escritura.carpeta_id}`);
        }

        return { success: true };
    } catch (error: any) {
        console.error("Error updating registry status:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Get deeds with expiring inscription deadlines
 * Returns deeds with traffic light status based on days remaining
 */
export async function getExpiringDeeds() {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("escrituras")
            .select(`
                id,
                nro_protocolo,
                fecha_firma_real,
                fecha_vencimiento_inscripcion,
                estado_inscripcion,
                nro_entrada_registro,
                carpetas (
                    id,
                    caratula
                )
            `)
            .not("fecha_firma_real", "is", null)
            .in("estado_inscripcion", ["PENDIENTE", "INGRESADA", "OBSERVADA"])
            .order("fecha_vencimiento_inscripcion", { ascending: true });

        if (error) throw error;

        // Calculate days remaining and add traffic light status
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const deedsWithStatus = (data || []).map((deed: any) => {
            const vencimiento = new Date(deed.fecha_vencimiento_inscripcion);
            vencimiento.setHours(0, 0, 0, 0);

            const diffTime = vencimiento.getTime() - today.getTime();
            const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let trafficLight: "green" | "yellow" | "red";
            if (daysRemaining < 0) {
                trafficLight = "red"; // Expired
            } else if (daysRemaining <= 15) {
                trafficLight = "yellow"; // Warning
            } else {
                trafficLight = "green"; // Safe
            }

            return {
                ...deed,
                daysRemaining,
                trafficLight
            };
        });

        return { success: true, data: deedsWithStatus };
    } catch (error: any) {
        console.error("Error fetching expiring deeds:", error);
        return { success: false, error: error.message, data: [] };
    }
}
