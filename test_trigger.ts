import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTrigger() {
    console.log("Testing insert...");
    const { data: insertData, error: insertError } = await supabase
        .from('protocolo_registros')
        .insert({
            anio: 2026,
            nro_escritura: 8888,
            es_errose: false
        })
        .select()
        .single();

    if (insertError) {
        console.error("Insert Error:", insertError);
        return;
    }
    console.log("Inserted:", insertData.id);

    console.log("Testing update...");
    const { data: updateData, error: updateError } = await supabase
        .from('protocolo_registros')
        .update({
            nro_escritura: 8889
        })
        .eq('id', insertData.id)
        .select()
        .single();

    if (updateError) {
        console.error("Update Error:", updateError);
    } else {
        console.log("Updated:", updateData.nro_escritura);
    }
}

testTrigger();
