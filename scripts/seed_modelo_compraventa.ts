/**
 * seed_modelo_compraventa.ts
 *
 * Script para insertar el primer modelo de acto (compraventa) en la tabla modelos_actos.
 *
 * Prerequisitos:
 *   1. Migración 035 ejecutada en Supabase
 *   2. Archivo template subido a Storage: escrituras/modelos_actos/compraventa/v1/template.docx
 *   3. Variables de entorno: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Uso:
 *   npx tsx scripts/seed_modelo_compraventa.ts
 *   — o —
 *   npx tsx scripts/seed_modelo_compraventa.ts --metadata path/to/metadata.json
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DOCX_STORAGE_PATH = "modelos_actos/compraventa/v1/template.docx";
const DEFAULT_METADATA_PATH = path.resolve(__dirname, "../test-files/template-builder/sample_metadata.json");

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    // 1. Resolver metadata path (puede venir por argumento)
    const args = process.argv.slice(2);
    let metadataPath = DEFAULT_METADATA_PATH;
    const metaIdx = args.indexOf("--metadata");
    if (metaIdx !== -1 && args[metaIdx + 1]) {
        metadataPath = path.resolve(args[metaIdx + 1]);
    }

    // 2. Leer metadata
    if (!fs.existsSync(metadataPath)) {
        console.error(`❌ No se encontró metadata en: ${metadataPath}`);
        process.exit(1);
    }
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
    console.log(`📋 Metadata cargado: ${metadata.template_name} (${metadata.total_variables} variables)`);

    // 3. Verificar que el .docx existe en Storage
    const { data: fileList, error: listError } = await supabase.storage
        .from("escrituras")
        .list("modelos_actos/compraventa/v1", { limit: 10 });

    const docxExists = fileList?.some((f) => f.name === "template.docx");
    if (listError || !docxExists) {
        console.warn(`⚠️  No se encontró template.docx en Storage (${DOCX_STORAGE_PATH}).`);
        console.warn(`   Subilo manualmente al bucket "escrituras" en esa ruta.`);
        console.warn(`   El seed continúa de todas formas — el registro queda listo.\n`);
    } else {
        console.log(`✅ Template DOCX encontrado en Storage: ${DOCX_STORAGE_PATH}`);
    }

    // 4. Verificar si ya existe un registro para este act_type
    const { data: existing } = await supabase
        .from("modelos_actos")
        .select("id, version, is_active")
        .eq("act_type", "compraventa")
        .eq("is_active", true)
        .limit(1)
        .single();

    if (existing) {
        console.log(`ℹ️  Ya existe un modelo activo para "compraventa" (id=${existing.id}, v${existing.version}).`);
        console.log(`   Desactivándolo para insertar nueva versión...`);

        await supabase
            .from("modelos_actos")
            .update({ is_active: false })
            .eq("id", existing.id);
    }

    // 5. Insertar el modelo
    const newVersion = existing ? existing.version + 1 : 1;

    const { data: inserted, error: insertError } = await supabase
        .from("modelos_actos")
        .insert({
            act_type: "compraventa",
            template_name: metadata.template_name || "compraventa_inmueble_template",
            label: "Compraventa de Inmueble",
            description: "Escritura pública de compraventa de inmueble — template generado por EscriAR Template Builder.",
            instrument_category: "ESCRITURA_PUBLICA",
            version: newVersion,
            is_active: true,
            docx_path: DOCX_STORAGE_PATH,
            metadata: metadata,
            total_variables: metadata.total_variables || 0,
            categories: metadata.categories_used || [],
        })
        .select()
        .single();

    if (insertError) {
        console.error(`❌ Error insertando modelo:`, insertError.message);
        process.exit(1);
    }

    console.log(`\n🎉 Modelo insertado exitosamente:`);
    console.log(`   ID:         ${inserted.id}`);
    console.log(`   Act Type:   ${inserted.act_type}`);
    console.log(`   Template:   ${inserted.template_name}`);
    console.log(`   Versión:    v${inserted.version}`);
    console.log(`   Variables:  ${inserted.total_variables}`);
    console.log(`   Categorías: ${inserted.categories.join(", ")}`);
    console.log(`   DOCX Path:  ${inserted.docx_path}`);
    console.log(`   Activo:     ${inserted.is_active}`);
    console.log(`\n✅ Listo. Ahora podés probar con:`);
    console.log(`   POST /api/templates/render { "carpeta_id": "<uuid>", "act_type": "compraventa" }`);
}

main().catch((err) => {
    console.error("Error fatal:", err);
    process.exit(1);
});
