import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findClientDocs() {
     // Encontrar una persona que tenga participaciones
     const { data: participaciones } = await supabase.from("participantes_operacion").select("persona_id, operacion_id").limit(10);
     if (!participaciones || !participaciones.length) {
          console.log("No hay participaciones"); return;
     }
     
     const personaIdWithPart = participaciones[0].persona_id;
     console.log("Found persona with participation:", personaIdWithPart);
     
     const { data: persona } = await supabase.from("personas").select("*").eq("id", personaIdWithPart).single();
     console.log("Persona:", persona?.nombre_completo);
     
     const personParts = participaciones.filter(p => p.persona_id === personaIdWithPart);
     const opIds = personParts.map(p => p.operacion_id);
     
     const { data: ops } = await supabase.from("operaciones").select("*").in("id", opIds);
     console.log("Ops:", ops?.length);
     
     if (ops && ops.length) {
          const carpetaIds = Array.from(new Set(ops.map(o => o.carpeta_id).filter(Boolean)));
          const escrituraIds = Array.from(new Set(ops.map(o => o.escritura_id).filter(Boolean)));
          
          let query = supabase.from("escrituras").select("*");
          if (carpetaIds.length > 0 && escrituraIds.length > 0) {
             query = query.or(`carpeta_id.in.(${carpetaIds.join(',')}),id.in.(${escrituraIds.join(',')})`);
          } else if (carpetaIds.length > 0) {
              query = query.in("carpeta_id", carpetaIds);
          } else if (escrituraIds.length > 0) {
              query = query.in("id", escrituraIds);
          } else {
             console.log("Ops have no carpeta_id nor escritura_id!");
             return;
          }
          
          const { data: escs } = await query;
          console.log("Escrituras related:", escs?.length);
          if (escs) escs.forEach(e => {
               console.log(` Escr ${e.id.substring(0,8)} | Source: ${e.source} | PDF: ${e.pdf_url ? 'Yes' : 'No'} | Proto: ${e.protocolo_registro_id ? 'Yes' : 'No'}`);
          });
     }
}
findClientDocs();
