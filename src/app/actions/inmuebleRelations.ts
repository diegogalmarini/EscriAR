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

        // 2. Find related Escrituras directly (Inmuebles are linked via escrituras.inmueble_princ_id)
        let { data: formalEscrituras } = await supabase
            .from("escrituras")
            .select("id, carpeta_id, fecha_escritura, nro_protocolo, pdf_url, source, registro, notario_interviniente, protocolo_registro_id")
            .eq("inmueble_princ_id", id)
            .order("fecha_escritura", { ascending: false });

        let escriturasData = formalEscrituras || [];

        // --- INICIO: Búsqueda Híbrida 360 (Documentos sueltos de INGESTA/PROTOCOLOS) ---
        const { data: rawEscrituras } = await supabase
            .from("escrituras")
            .select("id, carpeta_id, fecha_escritura, nro_protocolo, pdf_url, source, registro, notario_interviniente, protocolo_registro_id, detalles")
            .order("fecha_escritura", { ascending: false });

        const parts = inmueble.nomenclatura_catastral ? inmueble.nomenclatura_catastral.split(',').map((p: string) => p.trim().toUpperCase()) : [];
        const part1 = parts[0] || '';
        const part2 = parts[1] || '';

        const ingestasMatched = (rawEscrituras || []).filter((esc: any) => {
            if (!esc.detalles) return false;
            const rawText = JSON.stringify(esc.detalles).toUpperCase();
            
            if (part1 && part2 && rawText.includes(part1) && rawText.includes(part2)) return true;
            if (part1 && !part2 && part1.length > 5 && rawText.includes(part1)) return true;
            return false;
        });

        for (const ing of ingestasMatched) {
            if (!escriturasData.some(e => e.id === ing.id)) {
                escriturasData.push(ing);
            }
        }
        // --- FIN: Búsqueda Híbrida 360 ---

        if (escriturasData.length === 0) {
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

        const carpetaIds = Array.from(new Set(escriturasData.map((e: any) => e.carpeta_id).filter(Boolean)));
        const escrituraIds = Array.from(new Set(escriturasData.map((e: any) => e.id).filter(Boolean)));

        // 3. Get Carpetas
        let carpetas: any[] = [];
        if (carpetaIds.length > 0) {
            const { data: carpetasData } = await supabase
                .from("carpetas")
                .select("*")
                .in("id", carpetaIds);
            carpetas = carpetasData || [];
        }

        // 4. Resolve Protocolo PDFs for these escrituras
        const protoIds = escriturasData.map((e: any) => e.protocolo_registro_id).filter(Boolean);
        let protoRegistros: any[] = [];
        if (carpetaIds.length > 0 || protoIds.length > 0) {
            let query = supabase.from("protocolo_registros").select("id, carpeta_id, pdf_storage_path");
            
            if (carpetaIds.length > 0 && protoIds.length > 0) {
                query = query.or(`carpeta_id.in.(${carpetaIds.join(',')}),id.in.(${protoIds.join(',')})`);
            } else if (carpetaIds.length > 0) {
                query = query.in("carpeta_id", carpetaIds);
            } else {
                query = query.in("id", protoIds);
            }
            const { data } = await query;
            protoRegistros = data || [];
        }

        // Resolve Tramite PDFs (from INGESTA siblings)
        const tramiteCarpetaIds = escriturasData
            .filter((e: any) => e.source === 'TRAMITE' && e.carpeta_id && !e.pdf_url)
            .map((e: any) => e.carpeta_id);

        let ingestaEscrituras: any[] = [];
        if (tramiteCarpetaIds.length > 0) {
            const { data: ingestaData } = await supabase
                .from("escrituras")
                .select("*")
                .in("carpeta_id", tramiteCarpetaIds)
                .eq("source", "INGESTA");
            ingestaEscrituras = ingestaData || [];
        }

        const escrituras = escriturasData.map((esc: any) => {
            let pdfUrl = esc.pdf_url;
            let nroProtocolo = esc.nro_protocolo;
            let fechaEscritura = esc.fecha_escritura;
            let registro = esc.registro;
            let notario = esc.notario_interviniente;

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

            if (esc.source === 'TRAMITE' && esc.carpeta_id) {
                const ingesta = ingestaEscrituras.find((i: any) => i.carpeta_id === esc.carpeta_id);
                if (ingesta) {
                    if (!pdfUrl) pdfUrl = ingesta.pdf_url;
                    if (!nroProtocolo) nroProtocolo = ingesta.nro_protocolo;
                    if (!fechaEscritura) fechaEscritura = ingesta.fecha_escritura;
                    if (!registro) registro = ingesta.registro;
                    if (!notario) notario = ingesta.notario_interviniente;
                }
            }

            return {
                ...esc,
                nro_protocolo: nroProtocolo,
                fecha_escritura: fechaEscritura,
                pdf_url: pdfUrl,
                registro: registro,
                notario_interviniente: notario
            };
        });

        // 5. Build Operations to get Titular Actual
        let queryOps = supabase.from("operaciones").select("id, tipo_acto, created_at");
        if (carpetaIds.length > 0 && escrituraIds.length > 0) {
            queryOps = queryOps.or(`carpeta_id.in.(${carpetaIds.join(',')}),escritura_id.in.(${escrituraIds.join(',')})`);
        } else if (carpetaIds.length > 0) {
            queryOps = queryOps.in("carpeta_id", carpetaIds);
        } else {
            queryOps = queryOps.in("escritura_id", escrituraIds);
        }
        
        const { data: operaciones } = await queryOps.order("created_at", { ascending: false });

        let titularActual = null;

        if (operaciones && operaciones.length > 0) {
            // Check the most recent operation logically linked to this property
            const latestOp = operaciones[0];

            const { data: participantes } = await supabase
                .from("participantes_operacion")
                .select(`id, rol, persona:personas (*)`)
                .eq("operacion_id", latestOp.id)
                .in("rol", [
                    "COMPRADOR", "COMPRADORA", "ADQUIRENTE",
                    "CESIONARIO", "CESIONARIA", "DONATARIO", "DONATARIA",
                    "TITULAR", "PROPIETARIO", "PROPIETARIA",
                    "DEUDOR", "DEUDORA", "CONSTITUYENTE",
                    "FIDEICOMISARIO", "FIDEICOMISARIA",
                    "FIDUCIARIO", "FIDUCIARIA", "FIDUCIANTE",
                    "HEREDERO", "HEREDERA"
                ]);

            if (participantes && participantes.length > 0) {
                titularActual = participantes.map((p: any) => p.persona).filter(Boolean);
            } else {
                // Fallback: Get ALL participants except Escribano if no specific role matches
                const { data: allParticipantes } = await supabase
                    .from("participantes_operacion")
                    .select(`id, rol, persona:personas (*)`)
                    .eq("operacion_id", latestOp.id)
                    .neq("rol", "ESCRIBANO");

                if (allParticipantes && allParticipantes.length > 0) {
                    titularActual = allParticipantes.map((p: any) => p.persona).filter(Boolean);
                }
            }
        }

        return {
            success: true,
            data: {
                inmueble,
                carpetas,
                escrituras,
                titularActual // Array of persons
            }
        };

    } catch (error: any) {
        console.error("Error in getInmuebleWithRelations:", error);
        return { success: false, error: error.message };
    }
}
