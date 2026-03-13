import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log("Checking columns for 'inmuebles'");
    const { data: iCols, error: iErr } = await supabase.rpc('get_schema_columns', { table_name: 'inmuebles' });
    if (iErr) {
        // Fallback if custom RPC doesn't exist
         const { data, error } = await supabase
            .from('inmuebles')
            .select('*')
            .limit(1);
         console.log("inmuebles data:", data ? Object.keys(data[0] || {}) : "No data");
    } else {
        console.log(iCols);
    }
    
    console.log("Checking columns for 'operaciones'");
    const { data: oCols, error: oErr } = await supabase
        .from('operaciones')
        .select('*')
        .limit(1);
    console.log("operaciones data:", oCols ? Object.keys(oCols[0] || {}) : "No data");
    
    const { data: pCols } = await supabase
        .from('participantes_operacion')
        .select('*')
        .limit(1);
    console.log("participantes_operacion data:", pCols ? Object.keys(pCols[0] || {}) : "No data");

    const { data: cCols } = await supabase
        .from('carpetas')
        .select('*')
        .limit(1);
    console.log("carpetas data:", cCols ? Object.keys(cCols[0] || {}) : "No data");
}

checkSchema();
