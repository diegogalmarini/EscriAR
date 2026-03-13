require("dotenv").config({path: ".env.local"});
const { createClient } = require("@supabase/supabase-js");

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debug() {
    // 1. Encontrar el inmueble
    const { data: inmuebles, error: e1 } = await sb.from("inmuebles")
        .select("*")
        .ilike("nomenclatura_catastral", "%Manzana 50%")
        .ilike("nomenclatura_catastral", "%Unidad Funcional 63%");
        
    console.log("Inmuebles Encontrados:", inmuebles?.length);
    if (!inmuebles || inmuebles.length === 0) return;
    
    const inmueble = inmuebles[0];
    console.log("-> ID Inmueble:", inmueble.id);

    // 2. Buscar en operaciones_inmuebles
    const { data: opInm, error: e2 } = await sb.from("operaciones_inmuebles")
        .select("*")
        .eq("inmueble_id", inmueble.id);
        
    console.log("-> OpInmuebles (error?):", e2?.message);
    console.log("-> OpInmuebles Data:", opInm);
    
    if (opInm && opInm.length > 0) {
        const opIds = opInm.map(o => o.operacion_id);
        
        // 3. Buscar operaciones
        const { data: ops } = await sb.from("operaciones")
            .select("*")
            .in("id", opIds);
            
        console.log("-> Operaciones:", ops?.map(o => ({id: o.id, esc_id: o.escritura_id, carp_id: o.carpeta_id})));
        
        // 4. Buscar participantes (Titular)
        const { data: parts } = await sb.from("participantes_operacion")
            .select("*, persona:personas(*)")
            .in("operacion_id", opIds);
            
        console.log("-> Participantes:", parts?.map(p => ({op: p.operacion_id, rol: p.rol, persona: p.persona?.nombre_completo})));

        // 5. Buscar Escrituras
        const escIds = ops.map(o => o.escritura_id).filter(Boolean);
        const { data: esc } = await sb.from("escrituras")
            .select("id, carpeta_id, protocolo_registro_id")
            .in("id", escIds);
            
        console.log("-> Escrituras:", esc);
        
        // 6. Buscar el PDF en protocolo registros si lo hay
        const protoIds = esc?.map(e => e.protocolo_registro_id).filter(Boolean) || [];
        if (protoIds.length > 0) {
            const { data: protos } = await sb.from("protocolo_registros").select("id, pdf_storage_path").in("id", protoIds);
            console.log("-> Protocolos Registros:", protos);
        }
    } else {
        // ¿Qué tal si están vinculados al revés, o en operaciones.inmueble_id? NO, la DB usa operaciones_inmuebles.
        // Quizás el worker no creó operaciones_inmuebles. 
        // Vamos a buscar en escrituras donde inmueble esté
    }
}
debug();
