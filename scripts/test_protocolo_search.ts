import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltan variables de entorno SUPABASE_URL o KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: rawProtocoloRegistros, error } = await supabase
        .from("protocolo_registros")
        .select("id, anio, nro_escritura, tipo_acto, vendedor_acreedor, comprador_deudor, pdf_storage_path, extraction_data");

    if (error) {
        console.error("Error fetching", error);
        return;
    }

    console.log(`Encontrados ${rawProtocoloRegistros?.length} registros en protocolo_registros.`);
    const farina = rawProtocoloRegistros?.filter(pr => {
       const str = JSON.stringify(pr).toLowerCase();
       return str.includes("farina");
    });
    console.log("Menciones a Farina: ", JSON.stringify(farina, null, 2));

    // Test de terminos
    const searchTerms = ["20561803", "adriana", "farina"];
    const matches = farina?.filter(pr => {
        const searchString = `
            ${pr.vendedor_acreedor || ''} 
            ${pr.comprador_deudor || ''} 
            ${JSON.stringify(pr.extraction_data || {})}
        `.toLowerCase();
        
        console.log(`\nTesting PR ID ${pr.id}`);
        for (const term of searchTerms) {
            console.log(` - Checking term: "${term}"`);
            if (term && term.length > 3 && searchString.includes(term)) {
                console.log(`   -> MATCHED TERM: "${term}"`);
                return true;
            }
        }
        return false;
    });

    console.log("Matched con la logica del front:", matches?.length);
}

main();
