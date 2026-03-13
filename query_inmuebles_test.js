require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkInmuebles() {
    const { data: inmuebles, error } = await supabase
        .from('inmuebles')
        .select('*')
        .limit(10);
    if (error) {
        console.log("ERROR fetching", error);
        return;
    }
    
    fs.writeFileSync('inmuebles_test_output.json', JSON.stringify(inmuebles, null, 2));
}

checkInmuebles();
