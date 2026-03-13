import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getAllTables() {
    // There is no easy open endpoint to list all tables in Supabase JS without RPC or postgres meta.
    // Let's perform a query on information_schema if possible, but PostgREST prevents it.
    // However, I can just grep the local Prisma/SQL files or check typical names.
    
    // Instead, let's check what fields `escrituras` has:
    const { data: eCols } = await supabase.from('escrituras').select('*').limit(1);
    console.log("escrituras data:", eCols ? Object.keys(eCols[0] || {}) : "No data");
    
    // And let's find ANY table that starts with "inmueble" or "operacion" using a trick:
    // Actually, I can use grep locally on the SQL schema files or typescript types!
}

getAllTables();
