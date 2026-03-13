import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRel() {
    // Try querying a non-existent table to see the error, and an existent one.
    // I need to know the tables!
    // Let's query information_schema.tables using REST API is not possible, but we can do it with pg api if exposed.
    // What if I query `operaciones` and expand everything? (this shows all foreign keys)
    const { data: opData, error } = await supabase
        .from('operaciones')
        .select(`
            *,
            participantes_operacion(*),
            inmuebles_operacion(*)
        `)
        .limit(1);
    
    if (error) {
        console.error("Ops error:", error);
    } else {
        console.log("Ops data expanded:", JSON.stringify(opData, null, 2));
    }
}
checkRel();
