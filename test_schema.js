require("dotenv").config({path: ".env.local"});
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const { data } = await sb.from("operaciones").select("*").limit(1);
    if(data && data.length > 0) {
        console.log("Columnas de operaciones:", Object.keys(data[0]));
    } else {
        console.log("No hay datos en operaciones");
    }
}
main();
