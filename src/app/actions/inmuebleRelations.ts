"use server";

import { createClient } from "@/lib/supabaseServer";

export async function getInmuebleWithRelations(id: string) {
    try {
        const supabase = await createClient();

        // 1. Get Inmueble Data
        const { data: inmueble, error: inmuebleError } = await supabase
            .from("inmuebles")
            .select("*")
            .eq("id", id)
            .single();

        if (inmuebleError || !inmueble) {
            console.error("Error fetching inmueble:", inmuebleError);
            return { success: false, error: "No se encontró el inmueble" };
        }

        // 2. Find related Escrituras (Link to Carpetas & Owners)
        // We check if this inmueble is the 'princ' one in any escritura
        // (Junction table 'inmuebles_escritura' does not exist in current schema)

        let escrituraIds: string[] = [];

        const { data: directEscrituras, error: directError } = await supabase
            .from("escrituras")
            .select("id")
            .eq("inmueble_princ_id", id);

        if (directError) {
            console.error("Error fetching direct escrituras:", directError);
        }

        if (directEscrituras) {
            escrituraIds = directEscrituras.map(e => e.id);
        }

        if (escrituraIds.length === 0) {
            return {
                success: true,
                data: {
                    inmueble,
                    carpetas: [],
                    titularActual: null
                }
            };
        }

        // 3. Get Escrituras Details (to get Carpeta ID)
        const { data: escrituras } = await supabase
            .from("escrituras")
            .select("id, carpeta_id, fecha, nro_protocolo")
            .in("id", escrituraIds)
            .order("fecha", { ascending: false }); // Newest first

        const carpetaIds = escrituras?.map(e => e.carpeta_id).filter(Boolean) || [];

        // 4. Get Carpetas Linked
        const { data: carpetas } = await supabase
            .from("carpetas")
            .select("*")
            .in("id", carpetaIds);

        // 5. Infer Current Owner (Titular)
        // We look for the LATEST operation on these escrituras that is an ACQUISITION
        // We need Operaciones linked to these Escrituras
        const { data: operaciones } = await supabase
            .from("operaciones")
            .select("id, escritura_id, tipo_acto, fecha")
            .in("escritura_id", escrituraIds)
            .order("fecha", { ascending: false });

        let titularActual = null;

        console.log("Escritura IDs found:", escrituraIds);
        console.log("Operations found:", operaciones?.length);
        if (operaciones?.length) {
            console.log("Latest Op:", operaciones[0]);
        }

        if (operaciones && operaciones.length > 0) {
            // Find the most recent acquisition operation
            // This is a heuristic. We assume standard sales/donations.
            // A simplified approach: Get participants of the LATEST operation, filtering for 'COMPRADOR', 'ADQUIRENTE', 'CESIONARIO', 'DONATARIO'

            const latestOp = operaciones[0]; // Since we ordered by date desc (if fecha exists in operaciones, otherwise assume escritura fecha)

            const { data: participantes } = await supabase
                .from("participantes_operacion")
                .select(`
                    id, 
                    rol, 
                    persona:personas (*)
                `)
                .eq("operacion_id", latestOp.id)
                .in("rol", [
                    "COMPRADOR", "COMPRADORA", "ADQUIRENTE",
                    "CESIONARIO", "CESIONARIA",
                    "DONATARIO", "DONATARIA",
                    "TITULAR", "PROPIETARIO", "PROPIETARIA",
                    "DEUDOR", "DEUDORA", "CONSTITUYENTE",
                    "FIDEICOMISARIO", "FIDEICOMISARIA",
                    "FIDUCIARIO", "FIDUCIARIA", "FIDUCIANTE",
                    "HEREDERO", "HEREDERA"
                ]);

            console.log("Searching participants for Op:", latestOp.id, "Type:", latestOp.tipo_acto);

            if (participantes && participantes.length > 0) {
                console.log("Primary participants found:", participantes.length);
                // Return them as an array or single
                titularActual = participantes
                    .map(p => p.persona)
                    .filter(p => p !== null);
            } else {
                // Fallback: Get ALL participants except Escribano if no specific role matches
                const { data: allParticipantes } = await supabase
                    .from("participantes_operacion")
                    .select(`
                        id, 
                        rol, 
                        persona:personas (*)
                    `)
                    .eq("operacion_id", latestOp.id)
                    .neq("rol", "ESCRIBANO"); // Exclude the notary

                if (allParticipantes && allParticipantes.length > 0) {
                    console.log("Fallback participants found:", allParticipantes.length);
                    titularActual = allParticipantes
                        .map(p => p.persona)
                        .filter(p => p !== null);
                }
            }
        }

        console.log("Final Titular Actual:", titularActual);

        return {
            success: true,
            data: {
                inmueble,
                carpetas: carpetas || [],
                titularActual: titularActual // Array of persons
            }
        };

    } catch (error: any) {
        console.error("Error in getInmuebleWithRelations:", error);
        return { success: false, error: error.message };
    }
}
