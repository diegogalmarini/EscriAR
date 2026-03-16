import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFolders() {
  console.log("Fetching latest 10 folders...");
  
  const { data, error } = await supabase
    .from('carpetas')
    .select('id, caratula, created_at, ingesta_estado, ingesta_paso, resumen_ia')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error fetching folders:", error);
    return;
  }
  
  console.table(data);
}

checkFolders();
