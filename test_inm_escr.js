import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInmueblesOps() {
    console.log("--- Buscando inmueble Circunscripción I, Sección A, Manzana 50... ---");
    const { data: inmuebles, error: iErr } = await supabase
        .from('inmuebles')
        .select('id, nomenclatura_catastral')
        .ilike('nomenclatura_catastral', '%Manzana 50%')
        .limit(1);
        
    if (iErr) { console.error("Error inmuebles:", iErr); return; }
    if (inmuebles && inmuebles.length > 0) {
        const id = inmuebles[0].id;
        console.log("Inmueble encontrado ID:", id);
        
        // Let's see all escrituras pointing to this inmueble
        const { data: escrituras } = await supabase
            .from('escrituras')
            .select('*')
            .eq('inmueble_princ_id', id);
            
        console.log(`Escrituras apuntando a este inmueble: ${escrituras?.length || 0}`);
        if (escrituras && escrituras.length > 0) {
            console.log(escrituras.map(e => ({ id: e.id, source: e.source, file_name: e.file_name })));
        } else {
            console.log("No hay escrituras vinculadas a este inmueble por inmueble_princ_id!");
            
            // Is it possible the Inmueble ID is stored in the JSON `detalles` of `escrituras`? Or `tipo_acto`?
            // Actually, if it's NOT in `escrituras.inmueble_princ_id`, how did the system EVER show relations?
            // Wait, look at the original code in `inmuebleRelations.ts` from step 1930:
            // "The original code relied on a non-existent table operaciones_inmuebles"
            // If the original relied on `operaciones_inmuebles` which didn't exist, it ALWAYS returned empty!
            // Which means relations for inmuebles were NEVER WORKING in this project until I "fixed" them!
        }
    }
}
checkInmueblesOps();
