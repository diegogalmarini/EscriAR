import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAmbrogi() {
    const dni = '18277654';
    console.log(`Buscando a persona con DNI: ${dni}...`);
    
    // 1. Get the client (persona) data
    const { data: persona, error: personaError } = await supabase
        .from("personas")
        .select("*")
        .eq("dni", dni)
        .single();

    if (personaError) {
        console.error("Error fetching persona:", personaError);
        return;
    }
    console.log("Persona encontrada:", persona.id, persona.nombre_completo);

    // 2. Get participaciones in operaciones
    const { data: participaciones, error: partError } = await supabase
        .from("participantes_operacion")
        .select("*")
        .eq("persona_id", persona.id);

    if (partError) {
        console.error("Error fetching participaciones:", partError);
        return;
    }
    console.log(`Participaciones encontradas: ${participaciones?.length || 0}`);

    if (participaciones && participaciones.length > 0) {
        const operacionIds = participaciones.map(p => p.operacion_id);
        
        // 3. Get operaciones details
        const { data: operacionesData, error: opsError } = await supabase
            .from("operaciones")
            .select("*")
            .in("id", operacionIds);
            
        if (opsError) console.error("Error operaciones:", opsError);

        console.log(`Operaciones encontradas: ${operacionesData?.length || 0}`);
        
        if (operacionesData) {
            operacionesData.forEach(op => {
                console.log(`Op ${op.id} - carpeta_id: ${op.carpeta_id}, escritura_id: ${op.escritura_id}`);
            });
            
            // 4. Get escrituras details
            const carpetaIdsOps = Array.from(new Set(operacionesData.map(o => o.carpeta_id).filter(Boolean)));
            const escrituraIdsOps = Array.from(new Set(operacionesData.map(o => o.escritura_id).filter(Boolean)));
            
            console.log("IDs de carpeta de las ops:", carpetaIdsOps);
            console.log("IDs de escritura de las ops:", escrituraIdsOps);
            
            let query = supabase.from("escrituras").select("*");
            
            if (carpetaIdsOps.length > 0 && escrituraIdsOps.length > 0) {
                query = query.or(`carpeta_id.in.(${carpetaIdsOps.join(',')}),id.in.(${escrituraIdsOps.join(',')})`);
            } else if (carpetaIdsOps.length > 0) {
                query = query.in("carpeta_id", carpetaIdsOps);
            } else if (escrituraIdsOps.length > 0) {
                query = query.in("id", escrituraIdsOps);
            } else {
                console.log("No hay ni carpeta_id ni escritura_id asociados a estas operaciones.");
                return;
            }
            
            const { data: escriturasData, error: eErr } = await query;
            if (eErr) console.error("Error escrituras:", eErr);
            
            console.log(`Escrituras encontradas para la persona: ${escriturasData?.length || 0}`);
            if (escriturasData) {
                escriturasData.forEach(e => {
                    console.log(`Escritura ${e.id} [${e.source}] - file_name: ${e.file_name}, carpeta_id: ${e.carpeta_id}`);
                });
            }
        }
    }

    console.log("\\n--- Buscando inmueble Circunscripción I, Sección A, Manzana 50... ---");
    const { data: inmuebles, error: iErr } = await supabase
        .from('inmuebles')
        .select('id, nomenclatura_catastral')
        .ilike('nomenclatura_catastral', '%Manzana 50%')
        .limit(1);
        
    if (iErr) { console.error("Error inmuebles:", iErr); return; }
    if (inmuebles && inmuebles.length > 0) {
        console.log("Inmueble encontrado:", inmuebles[0]);
        if (inmuebles[0].inmueble_princ_id) {
            const { data: escr } = await supabase
                .from('escrituras')
                .select('id, file_name, source')
                .eq('id', inmuebles[0].inmueble_princ_id);
            console.log("Escritura principal del inmueble:", escr);
        } else {
            console.log("El inmueble_princ_id es nulo!");
            // Check if there are other ways this inmueble is linked to an escritura
            const { data: opsInm } = await supabase
                .from("operaciones")
                .select("*")
                .ilike("detalles", `%${inmuebles[0].id}%`); // Not exact, but maybe it's in a JSON field?
            console.log("Operaciones containing this inmueble id somewhere (just checking):", opsInm?.length);
            
            // Wait, how DOES an Inmueble link if not by inmueble_princ_id?
            // Let's check the schema for `inmuebles_operacion` or something similar that we thought didn't exist?
            // The previous code checked `inmuebles` for `inmueble_princ_id`. Let's see all columns of `inmuebles` table.
             const { data: all_inmuebles } = await supabase
                .from('inmuebles')
                .select('*')
                .eq('id', inmuebles[0].id)
                .single();
             console.log("Inmueble row full data:", all_inmuebles);
        }
    } else {
        console.log("No se encontró el inmueble");
    }
}

checkAmbrogi();
