import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    // try to fetch 1 escritura with all top level keys
    const { data: esc, error } = await supabase
        .from('escrituras')
        .select('*')
        .limit(1);
    
    if (error) {
        console.error("ERROR:", error);
    } else {
        console.log("COLUMNAS DE ESCRITURA:");
        console.log(Object.keys(esc[0]));
    }
}

test();
