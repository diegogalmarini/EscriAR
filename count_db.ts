import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing credentials!");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDB() {
    const { count, error } = await supabase
        .from('escrituras')
        .select('*', { count: 'exact', head: true });
        
    console.log("TOTAL ESCRITURAS IN DB:", count);
    if (error) console.error("Error:", error);
    
    // Check if INGESTA ones are there
    const { count: ingestaCount } = await supabase
        .from('escrituras')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'INGESTA');
    console.log("TOTAL INGESTA:", ingestaCount);
}

checkDB();
