"use server";

import { createClient } from "@/lib/supabaseServer";

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
        const operacionIds = participaciones?.map(p => p.operacion_id).filter(Boolean) || [];
        const { data: operacionesData } = await supabase
            .from("operaciones")
            .select("*")
            .in("id", operacionIds);

        console.log("[DEBUG] Operaciones:", operacionesData);

        // 4. Get escrituras details
        const escrituraIds = operacionesData?.map(o => o.escritura_id).filter(Boolean) || [];
        const { data: escriturasData } = await supabase
            .from("escrituras")
            .select("*")
            .in("id", escrituraIds);

        console.log("[DEBUG] Escrituras:", escriturasData);

        // 5. Get carpetas details
        const carpetaIds = escriturasData?.map(e => e.carpeta_id).filter(Boolean) || [];
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
        const operaciones = participaciones?.map(part => {
            const op = operacionesData?.find(o => o.id === part.operacion_id);
            const esc = escriturasData?.find(e => e.id === op?.escritura_id);
            const carp = carpetasData?.find(c => c.id === esc?.carpeta_id);

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
        }).filter(op => op.id) || [];

        const carpetas = carpetasData?.map(c => ({
            id: c.id,
            numero: c.nro_carpeta_interna,
            observaciones: c.observaciones || c.descripcion || ''
        })) || [];

        const escrituras = escriturasData?.map(e => ({
            id: e.id,
            numero: e.nro_protocolo,
            tipo: e.tipo // This might still be null, but let's keep it for now
        })) || [];

        // Mapear y deduplicar históricos otorgados
        const historicosOtorgados = (participacionesHistoricasOtorgadas || [])
            .filter((p, index, self) =>
                index === self.findIndex((t) => t.persona_id === p.persona_id)
            )
            .map(p => ({
                id: `hist-otorg-${p.id}`,
                otorgante_dni: dni,
                apoderado_dni: p.persona_id,
                nro_escritura: null,
                registro: null,
                escribano_autorizante: null,
                fecha_otorgamiento: null,
                facultades_extracto: p.datos_representacion?.poder_detalle || 'Poder histórico de operación',
                pdf_url: null,
                estado: 'HISTORICO',
                apoderado: p.persona
            }));

        // Mapear y deduplicar históricos activos
        const historicosActivos = (participacionesHistoricasActivas || [])
            .filter((p, index, self) =>
                index === self.findIndex((t) => t.datos_representacion?.representa_a === p.datos_representacion?.representa_a)
            )
            .map(p => ({
                id: `hist-act-${p.id}`,
                otorgante_dni: 'Desconocido', // No tenemos el DNI del otorgante en el histórico, solo el nombre
                apoderado_dni: dni,
                nro_escritura: null,
                registro: null,
                escribano_autorizante: null,
                fecha_otorgamiento: null,
                facultades_extracto: p.datos_representacion?.poder_detalle || 'Poder histórico de operación',
                pdf_url: null,
                estado: 'HISTORICO',
                otorgante: { nombre_completo: p.datos_representacion?.representa_a || 'Desconocido' }
            }));

        const poderesOtorgados = [...(poderesOtorgadosData || []), ...historicosOtorgados];
        const poderesActivos = [...(poderesActivosData || []), ...historicosActivos];

        return {
            success: true,
            data: {
                persona,
                operaciones,
                escrituras,
                carpetas,
                poderesOtorgados,
                poderesActivos
            }
        };
    } catch (error: any) {
        console.error("Error in getClientWithRelations:", error);
        return { success: false, error: error.message };
    }
}
