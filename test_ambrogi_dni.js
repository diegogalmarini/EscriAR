import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAmbrogiDni() {
    const searchDni = '18277654';
    console.log("Fetching escrituras containing DNI:", searchDni);

    let query = supabase.from("escrituras").select("id, folder_name, nro_protocolo, vendedores, compradores, titulares, otorgantes, poderdantes");
    const { data: escs, error } = await query;
    if (error) console.error(error);
    
    let matchedEscs = [];
    if (escs) {
        matchedEscs = escs.filter(e => {
            const strPayload = JSON.stringify([e.vendedores, e.compradores, e.titulares, e.otorgantes, e.poderdantes]);
            return strPayload.includes(searchDni);
        });
    }

    console.log(`Escrituras found via DNI matching: ${matchedEscs.length}`);
    matchedEscs.forEach(e => {
        console.log(`  Escr ${e.id.substring(0,6)}: ${e.folder_name}`);
    });
}
checkAmbrogiDni();
