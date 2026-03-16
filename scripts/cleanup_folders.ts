import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials.");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function cleanUp() {
  console.log("Cleaning up stuck PROCESANDO folders...");
  
  // 1. Delete folders stuck in PROCESANDO
  const { data: stuckFolders, error: getStuckErr } = await supabaseAdmin
    .from('carpetas')
    .select('id, caratula')
    .eq('ingesta_estado', 'PROCESANDO');

  if (getStuckErr) {
    console.error("Error fetching stuck folders:", getStuckErr);
  } else if (stuckFolders && stuckFolders.length > 0) {
    console.log(`Found ${stuckFolders.length} stuck folders. Deleting...`);
    const ids = stuckFolders.map(f => f.id);
    const { error: delErr } = await supabaseAdmin.from('carpetas').delete().in('id', ids);
    if (delErr) {
      console.error("Error deleting stuck folders:", delErr);
    } else {
      console.log("Stuck folders deleted.");
    }
  } else {
    console.log("No stuck folders found.");
  }

  // 2. Delete empty manual folders created by the button
  console.log("Cleaning up empty manual folders...");
  const { data: emptyFolders, error: getEmptyErr } = await supabaseAdmin
    .from('carpetas')
    .select('id, caratula, estado')
    .is('caratula', null)
    .eq('estado', 'ABIERTA')
    .is('ingesta_estado', null);
  
  if (getEmptyErr) {
      console.error("Error fetching empty manual folders:", getEmptyErr);
  } else if (emptyFolders && emptyFolders.length > 0) {
      console.log(`Found ${emptyFolders.length} empty manual folders. Deleting...`);
      const ids = emptyFolders.map(f => f.id);
      const { error: delErr } = await supabaseAdmin.from('carpetas').delete().in('id', ids);
      if (delErr) {
        console.error("Error deleting empty manual folders:", delErr);
      } else {
        console.log("Empty manual folders deleted.");
      }
  } else {
      console.log("No empty manual folders found.");
  }

  console.log("Cleanup complete!");
}

cleanUp();
