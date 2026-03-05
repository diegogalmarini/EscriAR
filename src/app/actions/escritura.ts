"use server";

import { createClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";

/**
 * Garantiza que la carpeta tiene una escritura TRAMITE (operación activa).
 * Si no existe, la crea con una operación vacía.
 * Retorna la escritura TRAMITE con operaciones y participantes.
 */
export async function ensureTramiteEscritura(carpetaId: string) {
    try {
        const supabase = await createClient();

        // Buscar TRAMITE existente
        const { data: existing } = await supabase
            .from("escrituras")
            .select("*, operaciones(*, participantes_operacion(*, persona:personas(*)))")
            .eq("carpeta_id", carpetaId)
            .eq("source", "TRAMITE")
            .maybeSingle();

        if (existing) return { success: true, escritura: existing };

        // No existe → crear escritura TRAMITE + operación vacía
        const { data: nuevaEscritura, error: escErr } = await supabase
            .from("escrituras")
            .insert({ carpeta_id: carpetaId, source: "TRAMITE" })
            .select()
            .single();

        if (escErr || !nuevaEscritura) throw escErr || new Error("No se pudo crear escritura TRAMITE");

        const { error: opErr } = await supabase
            .from("operaciones")
            .insert({ escritura_id: nuevaEscritura.id, tipo_acto: "POR_DEFINIR" });

        if (opErr) throw opErr;

        // Re-fetch con relaciones
        const { data: full } = await supabase
            .from("escrituras")
            .select("*, operaciones(*, participantes_operacion(*, persona:personas(*)))")
            .eq("id", nuevaEscritura.id)
            .single();

        return { success: true, escritura: full };
    } catch (error: any) {
        console.error("[ENSURE TRAMITE]", error);
        return { success: false, error: error.message };
    }
}

export async function updateEscritura(escrituraId: string, data: {
    nro_protocolo?: number | null;
    fecha_escritura?: string | null;
    notario_interviniente?: string | null;
    registro?: string | null;
    contenido_borrador?: string | null;
}) {
    try {
        const supabase = await createClient();
        const { error } = await supabase
            .from("escrituras")
            .update(data)
            .eq("id", escrituraId);

        if (error) throw error;

        revalidatePath("/carpeta/[id]");
        return { success: true };
    } catch (error: any) {
        console.error("[UPDATE ESCRITURA]", error);
        return { success: false, error: error.message };
    }
}

export async function updateOperacion(operacionId: string, data: {
    tipo_acto?: string;
    codigo?: string | null;
}) {
    try {
        const supabase = await createClient();
        const { error } = await supabase
            .from("operaciones")
            .update(data)
            .eq("id", operacionId);

        if (error) throw error;

        revalidatePath("/carpeta/[id]");
        return { success: true };
    } catch (error: any) {
        console.error("[UPDATE OPERACION]", error);
        return { success: false, error: error.message };
    }
}

export async function updateInmueble(inmuebleId: string, data: {
    partido_id?: string;
    nro_partida?: string;
}) {
    try {
        const supabase = await createClient();
        const { error } = await supabase
            .from("inmuebles")
            .update(data)
            .eq("id", inmuebleId);

        if (error) throw error;

        revalidatePath("/carpeta/[id]");
        return { success: true };
    } catch (error: any) {
        console.error("[UPDATE INMUEBLE]", error);
        return { success: false, error: error.message };
    }
}
