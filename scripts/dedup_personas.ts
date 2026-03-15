import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function normalizeName(name: string) {
    return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

async function main() {
    console.log("Iniciando deduplicación de Personas con TEMP- o SIN_DNI_ ...");

    // 1. Encontrar todos los registros problemáticos
    const { data: temps, error: tempErr } = await supabase
        .from('personas')
        .select('*')
        .or('dni.like.TEMP-%,dni.like.SIN_DNI_%');

    if (tempErr) {
        console.error("Error buscando TEMP:", tempErr.message);
        return;
    }

    if (!temps || temps.length === 0) {
        console.log("No se encontraron registros TEMP- o SIN_DNI_");
        return;
    }

    console.log(`Encontrados ${temps.length} registros problemáticos.`);

    // 2. Agrupar por nombre normalizado
    const grupos: Record<string, any[]> = {};
    for (const t of temps) {
        let n = normalizeName(t.nombre_completo);
        // Si tiene coma (ej "S.R.L., PROMAR"), demos vuelta
        if (n.includes(',')) {
            const parts = n.split(',').map(p => p.trim());
            n = parts.reverse().join(' ');
        }
        // Algunos recortes típicos
        n = n.replace('SOCIEDAD ANONIMA', 'SA')
             .replace('S A', 'SA')
             .replace('S.A.', 'SA')
             .replace('S.R.L.', 'SRL')
             .trim();
        
        if (!grupos[n]) grupos[n] = [];
        grupos[n].push(t);
    }

    for (const [nombre, duplicados] of Object.entries(grupos)) {
        console.log(`\n===========================================`);
        console.log(`Procesando grupo: ${nombre} (${duplicados.length} duplicados TEMP)`);

        // 3. Buscar un canónico exacto (que NO tenga TEMP- ni SIN_DNI_)
        let searchName = nombre.replace('SA', '').replace('SRL', '').replace(',', '').trim();
        if (searchName.length < 3) searchName = nombre; // Evitar búsqueda demasiado amplia
        
        const { data: canonicos } = await supabase
            .from('personas')
            .select('*')
            .ilike('nombre_completo', `%${searchName}%`)
            .not('dni', 'like', 'TEMP-%')
            .not('dni', 'like', 'SIN_DNI_%');

        let master = null;

        if (canonicos && canonicos.length > 0) {
            // Pick the first one as master
            master = canonicos[0];
            console.log(`  ✅ Maestro encontrado: ${master.nombre_completo} (DNI/CUIT: ${master.dni})`);
        } else {
            // Si no hay canónico, crearlo a partir del primer duplicado pero con un DNI limpio
            const base = duplicados[0];
            const nuevoDni = `ID_GEN_${Date.now()}`;
            console.log(`  ⚠️ No hay maestro. Creando nuevo: ${base.nombre_completo} con DNI: ${nuevoDni}`);
            
            const insertData = { ...base };
            delete insertData.dni; 
            insertData.dni = nuevoDni;

            const { data: newMaster, error: insErr } = await supabase
                .from('personas')
                .insert(insertData)
                .select('*')
                .single();
            
            if (insErr || !newMaster) {
                console.error("  ❌ Error creando maestro:", insErr?.message);
                continue;
            }
            master = newMaster;
        }

        // 4. Mover todas sus intervenciones al maestro
        for (const dup of duplicados) {
            console.log(`  Migrando actuaciones de: ${dup.dni} -> ${master.dni}`);
            const { error: updErr } = await supabase
                .from('participantes_operacion')
                .update({ persona_id: master.dni })
                .eq('persona_id', dup.dni);
            
            if (updErr) {
                // Si la actualización falla por restricción única (ya estaba participando en esa misma operacion), ignorar y limpiar el dup de todos modos (luego lo borramos).
                console.log(`    ⚠️ Aviso al migrar (probablemente duplicado real en la operación):`, updErr.message);
                
                // Borramos los remaining porque la FK en update falló. Master.dni ya estaba.
                console.log(`    ⚠️ Eliminando la particpación duplicada del TEMP para evitar violación de llave primaria.`);
                await supabase.from('participantes_operacion').delete().eq('persona_id', dup.dni);
            }

            // 4.b Update datos_representacion->>'representa_a' en otros participantes (no es foreign key, pero sirve)
            // No hacemos esto ahora para no complicarlo.

            // 5. Borrar el perfil temporal
            console.log(`  🗑️ Borrando TEMP profile: ${dup.dni}`);
            const { error: delErr } = await supabase
                .from('personas')
                .delete()
                .eq('dni', dup.dni);
            
            if (delErr) {
                console.error(`    ❌ No se pudo borrar ${dup.dni}:`, delErr.message);
            }
        }
    }

    console.log(`\nProceso completado.`);
}

main();
