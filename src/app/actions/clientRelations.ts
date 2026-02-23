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

        const { data: poderesActivosData } = await supabase
            .from("poderes")
            .select("*, otorgante:personas!poderes_otorgante_dni_fkey(*)")
            .eq("apoderado_dni", dni);

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

        const poderesOtorgados = poderesOtorgadosData || [];
        const poderesActivos = poderesActivosData || [];

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
