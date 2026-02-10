
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Use service role to bypass RLS
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugInmueble(partida: string) {
    console.log(`Searching for Inmueble with Partida: ${partida}...`);

    // 1. Find Inmueble
    const { data: inmuebles, error } = await supabase
        .from("inmuebles")
        .select("*")
        .ilike("nro_partida", `%${partida}%`);

    if (error || !inmuebles || inmuebles.length === 0) {
        console.error("Inmueble not found or error:", error);
        return;
    }

    const inmueble = inmuebles[0];
    console.log("Found Inmueble:", { id: inmueble.id, nomenclatura: inmueble.nomenclatura });

    // 2. Check Link Table
    // 2. Check Link Table - SKIPPED (Table does not exist)
    const links: any[] = [];
    // console.log("Inmuebles_Escritura Links:", links);

    // 3. Check Direct Link
    const { data: directEscrituras } = await supabase
        .from("escrituras")
        .select("id, nro_protocolo, carpeta_id")
        .eq("inmueble_princ_id", inmueble.id);

    console.log("Direct Escrituras (inmueble_princ_id):", directEscrituras);

    const allEscrituraIds = [
        ...(links?.map(l => l.escritura_id) || []),
        ...(directEscrituras?.map(e => e.id) || [])
    ];

    if (allEscrituraIds.length > 0) {
        // 4. Check Carpetas
        const { data: escrituras } = await supabase
            .from("escrituras")
            .select("id, carpeta_id, carpetas(*)") // Join carpetas
            .in("id", allEscrituraIds);

        console.log("Related Carpetas:", escrituras?.map(e => e.carpetas));

        // 5. Check Operations/Participantes
        const { data: operaciones } = await supabase
            .from("operaciones")
            .select("id, tipo_acto, participantes_operacion(id, rol, persona_id, personas(nombre_completo))")
            .in("escritura_id", allEscrituraIds);

        console.log("Related Operations:", JSON.stringify(operaciones, null, 2));
    } else {
        console.log("❌ No escrituras linked to this inmueble.");
    }
}

const partidaArg = process.argv[2];
if (partidaArg) {
    debugInmueble(partidaArg);
} else {
    console.log("Please provide a Partida number.");
}
