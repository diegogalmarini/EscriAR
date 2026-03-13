import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAmbrogi() {
    console.log("Fetching client AMBROGI...");
    const { data: clientes } = await supabase.from("personas").select("*").ilike("nombre_completo", "%AMBROGI%").limit(1);
    
    if (!clientes || !clientes.length) {
        console.log("No client found!");
        return;
    }
    const cliente = clientes[0];
    console.log("Cliente:", cliente.id, cliente.nombre_completo);

    let query = supabase.from("escrituras").select("id, folder_name, nro_protocolo, vendedores, compradores, titulares, otorgantes, poderdantes");

    const { data: escs, error } = await query;
    if (error) console.error(error);
    const searchStr = cliente.nombre_completo.toUpperCase();
    const searchDni = cliente.dni ? cliente.dni.toString() : 'NO_DNI';
    
    let matchedEscs = [];
    if (escs) {
        matchedEscs = escs.filter(e => {
            const strPayload = JSON.stringify([e.vendedores, e.compradores, e.titulares, e.otorgantes, e.poderdantes]).toUpperCase();
            return strPayload.includes(searchStr) || strPayload.includes(searchDni);
        });
    }

    console.log(`Escrituras found via JSON/text matching for ${cliente.nombre_completo}: ${matchedEscs.length}`);
    matchedEscs.forEach(e => {
        console.log(`  Escr ${e.id.substring(0,6)}: ${e.folder_name}`);
        console.log(`    V:${JSON.stringify(e.vendedores)}`);
        console.log(`    C:${JSON.stringify(e.compradores)}`);
        console.log(`    T:${JSON.stringify(e.titulares)}`);
    });
}
checkAmbrogi();
