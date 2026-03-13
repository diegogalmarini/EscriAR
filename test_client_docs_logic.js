import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testClientRelations() {
     const { data: participaciones } = await supabase.from("participantes_operacion").select("persona_id, operacion_id").limit(10);
     const dni = participaciones[0].persona_id; // in DB it's DNI, eg '25765599'
     
     const { data: persona } = await supabase.from("personas").select("*").eq("dni", dni).single();
     if (!persona) return console.log("Persona null for DNI", dni);
     console.log("Testing persona:", persona.nombre_completo);
     
     const { data: parts } = await supabase.from("participantes_operacion").select("*").eq("persona_id", dni);
     const operacionIds = parts?.map(p => p.operacion_id).filter(Boolean) || [];
     const { data: operacionesData } = await supabase.from("operaciones").select("*").in("id", operacionIds);
     
     const carpetaIdsOps = Array.from(new Set(operacionesData?.map(o => o.carpeta_id).filter(Boolean) || []));
     const escrituraIdsOps = Array.from(new Set(operacionesData?.map(o => o.escritura_id).filter(Boolean) || []));
     
     let escriturasData = [];
     if (carpetaIdsOps.length > 0 || escrituraIdsOps.length > 0) {
         let query = supabase.from("escrituras").select("*");
         if (carpetaIdsOps.length > 0 && escrituraIdsOps.length > 0) {
             query = query.or(`carpeta_id.in.(${carpetaIdsOps.join(',')}),id.in.(${escrituraIdsOps.join(',')})`);
         } else if (carpetaIdsOps.length > 0) {
             query = query.in("carpeta_id", carpetaIdsOps);
         } else {
             query = query.in("id", escrituraIdsOps);
         }
         const { data } = await query.order("fecha_escritura", { ascending: false });
         escriturasData = data || [];
     }
     
     console.log(`Escturas raw Data size: ${escriturasData.length}. Source distribution:`, escriturasData.map(e => e.source));
     
     const documentos = escriturasData?.map(esc => {
            const relatedOps = operacionesData?.filter(o => 
                (o.escritura_id && o.escritura_id === esc.id) || 
                (o.carpeta_id && esc.carpeta_id && o.carpeta_id === esc.carpeta_id)
            ) || [];
            if (relatedOps.length === 0) return null; // If no ops relate to it? wait. The UI MAPS over escriturasData without filtering empty relatedOps!
            const opIds = relatedOps.map(o => o.id);
            const part = parts?.find(p => opIds.includes(p.operacion_id));
            const op = relatedOps[0];

            let pdfUrl = esc.pdf_url;
            return {
                id: esc.id,
                nombre: esc.folder_name,
                url: pdfUrl || '#',
                source: esc.source,
                relacion: part?.rol,
                relatedOpsCount: relatedOps.length
            };
        }).filter(Boolean) || [];
        
    console.log("Documentos Returned to UI:", JSON.stringify(documentos, null, 2));
}
testClientRelations();
