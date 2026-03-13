import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAll() {
    // Try to get a row from any potential join table
    const tableNames = [
        'inmuebles_operacion',
        'inmuebles_operaciones',
        'operacion_inmuebles',
        'operaciones_inmuebles',
        'inmuebles_escrituras',
        'escrituras_inmuebles',
        'inmuebles_carpetas',
        'carpetas_inmuebles'
    ];
    
    for (let table of tableNames) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.log(`Table ${table} failed:`, error.message);
        } else {
            console.log(`>>> FOUND TABLE ${table} !!! <<<`);
            console.log(Object.keys(data[0] || {}));
        }
    }
}
checkAll();
