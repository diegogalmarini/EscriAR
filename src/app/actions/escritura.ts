"use server";

import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
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

        // Copiar titulares del INGESTA como VENDEDOR
        await syncVendedoresFromIngesta(carpetaId);

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

/**
 * Sincroniza vendedores desde INGESTA → TRAMITE.
 * El COMPRADOR/ADQUIRENTE del antecedente es el propietario actual = VENDEDOR en la nueva operación.
 * Idempotente: solo inserta si no existe ya en la operación TRAMITE.
 */
export async function syncVendedoresFromIngesta(carpetaId: string) {
    try {
        // 1. Obtener operación TRAMITE
        const { data: tramiteEsc } = await supabaseAdmin
            .from("escrituras")
            .select("operaciones(id, participantes_operacion(persona_id, rol))")
            .eq("carpeta_id", carpetaId)
            .eq("source", "TRAMITE")
            .maybeSingle();

        const tramiteOp = (tramiteEsc as any)?.operaciones?.[0];
        if (!tramiteOp) return { success: false, error: "No hay operación TRAMITE" };

        // 2. Obtener titulares del INGESTA (COMPRADOR/ADQUIRENTE = propietario actual)
        const { data: ingestaEscs } = await supabaseAdmin
            .from("escrituras")
            .select(`
                operaciones (
                    participantes_operacion (
                        rol,
                        persona_id
                    )
                )
            `)
            .eq("carpeta_id", carpetaId)
            .eq("source", "INGESTA");

        if (!ingestaEscs || ingestaEscs.length === 0) return { success: true, added: 0 };

        const ROLES_TITULAR = ["COMPRADOR", "ADQUIRENTE", "DONATARIO", "CESIONARIO"];
        const titularesDnis: string[] = [];

        for (const esc of ingestaEscs) {
            for (const op of (esc as any).operaciones || []) {
                for (const po of op.participantes_operacion || []) {
                    const rol = po.rol?.toUpperCase() || "";
                    if (ROLES_TITULAR.includes(rol) && po.persona_id) {
                        titularesDnis.push(po.persona_id);
                    }
                }
            }
        }

        if (titularesDnis.length === 0) return { success: true, added: 0 };

        // 3. Filtrar los que ya están en TRAMITE (cualquier rol)
        const existingDnis = new Set(
            (tramiteOp.participantes_operacion || []).map((p: any) => p.persona_id)
        );

        const toAdd = titularesDnis.filter(dni => !existingDnis.has(dni));
        if (toAdd.length === 0) return { success: true, added: 0 };

        // 4. Insertar como VENDEDOR
        const rows = toAdd.map(dni => ({
            operacion_id: tramiteOp.id,
            persona_id: dni,
            rol: "VENDEDOR",
        }));

        const { error: insertErr } = await supabaseAdmin
            .from("participantes_operacion")
            .insert(rows);

        if (insertErr) throw insertErr;

        console.log(`[syncVendedores] Agregados ${toAdd.length} vendedores desde INGESTA:`, toAdd);
        return { success: true, added: toAdd.length };
    } catch (error: any) {
        console.error("[syncVendedoresFromIngesta]", error);
        return { success: false, error: error.message };
    }
}
