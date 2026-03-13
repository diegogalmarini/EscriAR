"use server";

import { createClient } from "@/lib/supabaseServer";

function extractPoderData(text: string) {
    if (!text) return {
        nro_escritura: null,
        fecha_otorgamiento: null,
        escribano_autorizante: null,
        tipo_poder: null
    };

    // Extraer tipo de poder: "poder general amplio que le fuera conferido..."
    const tipoPoderMatch = text.match(/^\s*(poder[^,()]*?)(?:\s+que|\s+otorgad|\s+conferid|\s+por\s+escritura)/i);
    const tipo_poder = tipoPoderMatch ? tipoPoderMatch[1].trim() : null;

    // Extraer número de escritura: "escritura número 100", "escritura N° 100", etc.
    const nroMatch = text.match(/escritura[^\d]+(\d+)/i);
    const nro_escritura = nroMatch ? nroMatch[1] : null;

    // Extraer fecha: "21 de marzo de 2.018" o similar
    const fechaMatch = text.match(/fecha\s+(\d{1,2}\s+de\s+[a-záéíóú]+\s+de\s+[\d.]+)/i);
    const fecha_otorgamiento = fechaMatch ? fechaMatch[1] : null;

    // Extraer escribano: 
    const escrMatch = text.match(/escriban[oa](.*?)(?:,|$)/i);
    let escribano_autorizante = null;
    if (escrMatch) {
        let escName = escrMatch[1].trim();
        // Limpiar jurisdicciones y prefijos comunes
        escName = escName.replace(/^(?:de\sla\sCiudad\sAut[oó]noma\sde\sBuenos\sAires|de\sesta\sCiudad|de\sCapital\sFederal|autorizante|titular|interino|adscripto)\s*/ig, '');
        // El nombre propio que queda
        escribano_autorizante = escName.trim();
        // Si no quedó nada útil por algún motivo, lo dejamos null
        if (escribano_autorizante.length < 5) escribano_autorizante = null;
    }

    return {
        nro_escritura,
        fecha_otorgamiento,
        escribano_autorizante,
        tipo_poder
    };
}

export async function getClientWithRelations(dni: string) {
    try {
        const supabase = await createClient();
        // 1. Get the client (persona) data
        const { data: persona, error: personaError } = await supabase
            .from("personas")
            .select("*")
            .eq("dni", dni)
            .single();

        if (personaError) {
            console.error("Error fetching persona:", personaError);
            return { success: false, error: "No se encontró el cliente" };
        }

        // 2. Get participaciones in operaciones
        const { data: participaciones, error: partError } = await supabase
            .from("participantes_operacion")
            .select("*")
            .eq("persona_id", dni);

        if (partError) {
            console.error("Error fetching participaciones:", partError);
        }

        console.log("[DEBUG] Participaciones for DNI", dni, ":", participaciones);

        // 3. Get operaciones details
        const operacionIds = participaciones?.map((p: any) => p.operacion_id).filter(Boolean) || [];
        const { data: operacionesData } = await supabase
            .from("operaciones")
            .select("*")
            .in("id", operacionIds);

        console.log("[DEBUG] Operaciones:", operacionesData);

        // 4. Get escrituras details
        const escrituraIds = operacionesData?.map((o: any) => o.escritura_id).filter(Boolean) || [];
        const { data: escriturasData } = await supabase
            .from("escrituras")
            .select("*")
            .in("id", escrituraIds);

        console.log("[DEBUG] Escrituras:", escriturasData);

        // 5. Get carpetas details
        const carpetaIds = escriturasData?.map((e: any) => e.carpeta_id).filter(Boolean) || [];
        const { data: carpetasData } = await supabase
            .from("carpetas")
            .select("*")
            .in("id", carpetaIds);

        console.log("[DEBUG] Carpetas:", carpetasData);

        // 6. Get Poderes
        const { data: poderesOtorgadosData } = await supabase
            .from("poderes")
            .select("*, apoderado:personas!poderes_apoderado_dni_fkey(*)")
            .eq("otorgante_dni", dni);

        // 6b. Obtener Poderes Históricos (donde es otorgante/representado)
        // Buscamos en participantes_operacion donde datos_representacion->>representa_a contiene el nombre de este cliente
        // Esto es un poco más complejo porque requiere buscar por nombre en el JSON. 
        // Lo simplificaremos buscando todas las participaciones con rol APODERADO en las operaciones donde este cliente participa, o buscando textualmente
        const { data: participacionesHistoricasOtorgadas } = await supabase
            .from("participantes_operacion")
            .select("*, persona:personas!participantes_operacion_persona_id_fkey(*)")
            .ilike("rol", "%APODERADO%")
            .filter("datos_representacion->>representa_a", "ilike", `%${persona.nombre_completo}%`);

        const { data: poderesActivosData } = await supabase
            .from("poderes")
            .select("*, otorgante:personas!poderes_otorgante_dni_fkey(*)")
            .eq("apoderado_dni", dni);

        // 6d. Obtener Poderes Históricos Activos (donde es apoderado en una operacion)
        const { data: participacionesHistoricasActivas } = await supabase
            .from("participantes_operacion")
            .select("*")
            .eq("persona_id", dni)
            .ilike("rol", "%APODERADO%");

        console.log("[DEBUG] Poderes Otorgados:", poderesOtorgadosData);
        console.log("[DEBUG] Poderes Activos:", poderesActivosData);

        // 7. Build the relationships
        const operaciones = participaciones?.map((part: any) => {
            const op = operacionesData?.find((o: any) => o.id === part.operacion_id);
            const esc = escriturasData?.find((e: any) => e.id === op?.escritura_id);
            const carp = carpetasData?.find((c: any) => c.id === esc?.carpeta_id);

            return {
                id: op?.id || '',
                tipo: op?.tipo_acto || '',
                rol: part.rol || '',
                escritura: esc ? {
                    id: esc.id,
                    numero: esc.nro_protocolo,
                    tipo: op?.tipo_acto,
                    carpeta: carp ? {
                        id: carp.id,
                        numero: carp.nro_carpeta_interna
                    } : undefined
                } : undefined
            };
        }).filter((op: any) => op.id) || [];

        const carpetas = carpetasData?.map((c: any) => ({
            id: c.id,
            numero: c.nro_carpeta_interna,
            observaciones: c.observaciones || c.descripcion || ''
        })) || [];

        const escrituras = escriturasData?.map((e: any) => ({
            id: e.id,
            numero: e.nro_protocolo,
            tipo: e.tipo // This might still be null, but let's keep it for now
        })) || [];

        // 7b. For TRAMITE escrituras, fetch their INGESTA siblings to get pdf_url
        const tramiteCarpetaIds = escriturasData
            ?.filter((e: any) => e.source === 'TRAMITE' && e.carpeta_id && !e.pdf_url)
            .map((e: any) => e.carpeta_id) || [];

        let ingestaEscrituras: any[] = [];
        if (tramiteCarpetaIds.length > 0) {
            const { data: ingestaData } = await supabase
                .from("escrituras")
                .select("*")
                .in("carpeta_id", tramiteCarpetaIds)
                .eq("source", "INGESTA");
            ingestaEscrituras = ingestaData || [];
        }

        // 7c. Build enriched documentos for "Documentos Relacionados" tab
        const documentos = escriturasData?.map((esc: any) => {
            const relatedOps = operacionesData?.filter((o: any) => o.escritura_id === esc.id) || [];
            const opIds = relatedOps.map((o: any) => o.id);
            const part = participaciones?.find((p: any) => opIds.includes(p.operacion_id));
            const op = relatedOps[0];

            // For TRAMITE escrituras without pdf_url, get it from the INGESTA sibling
            let pdfUrl = esc.pdf_url;
            let nroProtocolo = esc.nro_protocolo;
            let fechaEscritura = esc.fecha_escritura;
            let registro = esc.registro;
            let notario = esc.notario_interviniente;

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
                id: esc.id,
                nro_protocolo: nroProtocolo,
                fecha_escritura: fechaEscritura,
                pdf_url: pdfUrl,
                source: esc.source,
                registro: registro,
                notario_interviniente: notario,
                carpeta_id: esc.carpeta_id,
                tipo_acto: op?.tipo_acto || null,
                rol: part?.rol || null,
            };
        }) || [];

        // Mapear y deduplicar históricos otorgados
        const historicosOtorgados = (participacionesHistoricasOtorgadas || [])
            .filter((p: any, index: number, self: any[]) =>
                index === self.findIndex((t: any) => t.persona_id === p.persona_id)
            )
            .map((p: any) => {
                const extracted = extractPoderData(p.datos_representacion?.poder_detalle || '');
                return {
                    id: `hist-otorg-${p.id}`,
                    otorgante_dni: dni,
                    apoderado_dni: p.persona_id,
                    nro_escritura: extracted.nro_escritura,
                    tipo_poder: extracted.tipo_poder,
                    escribano_autorizante: extracted.escribano_autorizante,
                    fecha_otorgamiento: extracted.fecha_otorgamiento,
                    facultades_extracto: p.datos_representacion?.poder_detalle || 'Poder histórico de operación',
                    pdf_url: null,
                    estado: 'HISTORICO',
                    apoderado: p.persona
                };
            });

        // Mapear y deduplicar históricos activos
        const historicosActivos = (participacionesHistoricasActivas || [])
            .filter((p: any, index: number, self: any[]) =>
                index === self.findIndex((t: any) => t.datos_representacion?.representa_a === p.datos_representacion?.representa_a)
            )
            .map((p: any) => {
                const extracted = extractPoderData(p.datos_representacion?.poder_detalle || '');
                return {
                    id: `hist-act-${p.id}`,
                    otorgante_dni: 'Desconocido', // No tenemos el DNI del otorgante en el histórico, solo el nombre
                    apoderado_dni: dni,
                    nro_escritura: extracted.nro_escritura,
                    tipo_poder: extracted.tipo_poder,
                    escribano_autorizante: extracted.escribano_autorizante,
                    fecha_otorgamiento: extracted.fecha_otorgamiento,
                    facultades_extracto: p.datos_representacion?.poder_detalle || 'Poder histórico de operación',
                    pdf_url: null,
                    estado: 'HISTORICO',
                    otorgante: { nombre_completo: p.datos_representacion?.representa_a || 'Desconocido' }
                };
            });

        const poderesOtorgados = [...(poderesOtorgadosData || []), ...historicosOtorgados];
        const poderesActivos = [...(poderesActivosData || []), ...historicosActivos];

        return {
            success: true,
            data: {
                persona,
                operaciones,
                escrituras,
                carpetas,
                documentos,
                poderesOtorgados,
                poderesActivos
            }
        };
    } catch (error: any) {
        console.error("Error in getClientWithRelations:", error);
        return { success: false, error: error.message };
    }
}
