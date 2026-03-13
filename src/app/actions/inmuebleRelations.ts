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

        // 2. Find related Escrituras via Operaciones
        const { data: opInmuebles } = await supabase
            .from("operaciones_inmuebles")
            .select("operacion_id")
            .eq("inmueble_id", id);
        
        const operacionIds = opInmuebles?.map((o: any) => o.operacion_id).filter(Boolean) || [];

        let carpetaIds: string[] = [];
        let escrituraIds: string[] = [];
        if (operacionIds.length > 0) {
            const { data: operacionesData } = await supabase
                .from("operaciones")
                .select("carpeta_id, escritura_id")
                .in("id", operacionIds);
            
            carpetaIds = Array.from(new Set(operacionesData?.map((o: any) => o.carpeta_id).filter(Boolean) || []));
            escrituraIds = Array.from(new Set(operacionesData?.map((o: any) => o.escritura_id).filter(Boolean) || []));
        }

        if (carpetaIds.length === 0 && escrituraIds.length === 0) {
            return {
                success: true,
                data: {
                    inmueble,
                    carpetas: [],
                    escrituras: [],
                    titularActual: null
                }
            };
        }

        // 3. Get Escrituras Details (to get Carpeta ID + PDF link)
        let queryEscrituras = supabase.from("escrituras").select(`
            id, carpeta_id, fecha_escritura, nro_protocolo, pdf_url, source, registro, notario_interviniente, protocolo_registro_id
        `);
        
        if (carpetaIds.length > 0 && escrituraIds.length > 0) {
            queryEscrituras = queryEscrituras.or(`carpeta_id.in.(${carpetaIds.join(',')}),id.in.(${escrituraIds.join(',')})`);
        } else if (carpetaIds.length > 0) {
            queryEscrituras = queryEscrituras.in("carpeta_id", carpetaIds);
        } else {
            queryEscrituras = queryEscrituras.in("id", escrituraIds);
        }

        const { data: escriturasData } = await queryEscrituras.order("fecha_escritura", { ascending: false }); // Newest first

        const allCarpetaIds = escriturasData?.map((e: any) => e.carpeta_id).filter(Boolean) || [];
        const protoIds = escriturasData?.map((e: any) => e.protocolo_registro_id).filter(Boolean) || [];

        let protoRegistros: any[] = [];
        if (allCarpetaIds.length > 0 || protoIds.length > 0) {
            let query = supabase.from("protocolo_registros").select("id, carpeta_id, pdf_storage_path");
            
            if (allCarpetaIds.length > 0 && protoIds.length > 0) {
                query = query.or(`carpeta_id.in.(${allCarpetaIds.join(',')}),id.in.(${protoIds.join(',')})`);
            } else if (allCarpetaIds.length > 0) {
                query = query.in("carpeta_id", allCarpetaIds);
            } else {
                query = query.in("id", protoIds);
            }
            const { data } = await query;
            protoRegistros = data || [];
        }

        const escrituras = escriturasData?.map((esc: any) => {
            let pdfUrl = esc.pdf_url;
            if (!pdfUrl) {
                const protoReg = protoRegistros.find((p: any) => 
                    (esc.carpeta_id && p.carpeta_id === esc.carpeta_id) || 
                    (esc.protocolo_registro_id && p.id === esc.protocolo_registro_id)
                );
                const path = protoReg?.pdf_storage_path;
                if (path) {
                    if (path.startsWith('http')) {
                        pdfUrl = path;
                    } else {
                        const { data: publicUrlData } = supabase.storage.from("protocolo").getPublicUrl(path);
                        pdfUrl = publicUrlData.publicUrl;
                    }
                }
            }
            return {
                ...esc,
                pdf_url: pdfUrl
            };
        });

        // 4. Get Carpetas Linked
        const { data: carpetas } = await supabase
            .from("carpetas")
            .select("*")
            .in("id", carpetaIds);

        // 5. Infer Current Owner (Titular)
        // We look for the LATEST operation on these escrituras that is an ACQUISITION
        // We already have operacionIds from the inmueble's relationships!
        const { data: operaciones } = await supabase
            .from("operaciones")
            .select("id, tipo_acto, created_at")
            .in("id", operacionIds)
            .order("created_at", { ascending: false });

        let titularActual = null;

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
                    .map((p: any) => p.persona)
                    .filter((p: any) => p !== null);
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
                        .map((p: any) => p.persona)
                        .filter((p: any) => p !== null);
                }
            }
        }

        console.log("Final Titular Actual:", titularActual);

        return {
            success: true,
            data: {
                inmueble,
                carpetas: carpetas || [],
                escrituras: escrituras || [],
                titularActual: titularActual // Array of persons
            }
        };

    } catch (error: any) {
        console.error("Error in getInmuebleWithRelations:", error);
        return { success: false, error: error.message };
    }
}
