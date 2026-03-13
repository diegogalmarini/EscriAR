import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFKs() {
    try {
        console.log("Intentando consultar pg_catalog/REST endpoints ocultos...");
        // Supabase REST client doesn't expose information_schema directly unless configured.
        // Let's check `detalles` field inside `operaciones` to see if there is ANY JSON data linking it.
        const { data: cols } = await supabase.from('operaciones').select('*').limit(1);
        console.log("Operaciones cols:", cols ? Object.keys(cols[0]) : "none");
        
        // Wait, did I look at the schemas correctly? Let's query `carpetas`.
        const { data: oCols } = await supabase.from('inmuebles').select('*').limit(1);
        console.log("Inmuebles cols:", oCols ? Object.keys(oCols[0] : "none"));
        
        // Let's do a text search across ALL columns of ALL operations.
        const { data: ops } = await supabase.from('operaciones').select('*').limit(10);
        console.log("Muestra de operaciones:", JSON.stringify(ops, null, 2));
    } catch (e) {
        console.error(e);
    }
}
checkFKs();
