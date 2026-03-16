import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// --- Configuración ---
const PDF_DIR = path.resolve(__dirname, '../protocolo_2026_pdfs');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const DELAY_MS = parseInt(process.env.DELAY_MS || '3000', 10);

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_API_KEY) {
    console.error("❌ Faltan variables de entorno (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY)");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const ai = new GoogleGenerativeAI(GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(GEMINI_API_KEY);

// Usa Pro para extracción precisa, o Flash si prefieres velocidad
const MODEL_NAME = "gemini-2.5-pro"; 

// --- Schema de Extracción IA ---
const PROTOCOLO_SCHEMA = {
    type: SchemaType.OBJECT,
    properties: {
        nro_escritura: { type: SchemaType.INTEGER, description: "Número de escritura. Ej: 145" },
        fecha: { type: SchemaType.STRING, description: "Fecha en formato YYYY-MM-DD" },
        folios: { type: SchemaType.STRING, description: "Rango de folios, ej. '001/005'" },
        tipo_acto: { type: SchemaType.STRING, description: "Naturaleza del acto, ej: 'Compraventa'" },
        vendedor_acreedor: { type: SchemaType.STRING, description: "Nombre completo de los vendedores o cedentes" },
        comprador_deudor: { type: SchemaType.STRING, description: "Nombre completo de los compradores o cesionarios" },
        codigo_acto: { type: SchemaType.STRING, description: "Código CESBA si es posible identificarlo" },
        monto_ars: { type: SchemaType.NUMBER, description: "Monto en pesos, si existe" },
        monto_usd: { type: SchemaType.NUMBER, description: "Monto en dólares, si existe" },
        inmueble_descripcion: { type: SchemaType.STRING, description: "Resumen de la ubicación o nomenclatura del inmueble" },
        observaciones_ia: { type: SchemaType.STRING, description: "Notas adicionales, ej. fideicomiso u otra rareza" },
    },
    required: ["nro_escritura", "fecha", "tipo_acto"]
};

/**
 * Espera a que un archivo en Gemini pase a estado 'ACTIVE'.
 */
async function waitForFileActive(name: string): Promise<void> {
    console.log(`   ⏳ Esperando procesamiento en Gemini (${name})...`);
    let file = await fileManager.getFile(name);
    while (file.state === 'PROCESSING') {
        process.stdout.write('.');
        await new Promise(r => setTimeout(r, 2000));
        file = await fileManager.getFile(name);
    }
    console.log('');
    if (file.state === 'FAILED') {
        throw new Error('El procesamiento del archivo en Gemini falló.');
    }
}

/**
 * Función principal para procesar un documento.
 */
async function procesarProtocolo(filePath: string, fileName: string) {
    let aiFileRef = null;
    let uploadPath = null;
    try {
        // 1. Subir a Supabase Storage (carpeta 'protocolo')
        const fileBuffer = fs.readFileSync(filePath);
        // We will assume year is 2026 as per directory name
        const anio = 2026;
        uploadPath = `protocolo_${anio}/${fileName}`;
        
        console.log(`   ☁️  Subiendo a Supabase Storage: ${uploadPath}...`);
        const { error: storageErr } = await supabase.storage
            .from('protocolo')
            .upload(uploadPath, fileBuffer, { contentType: 'application/pdf', upsert: true });

        if (storageErr) {
            console.error(`   ⚠️ Notice: Error subiendo Storage (puede que ya exista): ${storageErr.message}`);
            // Continuamos igual por si ya existía.
        }

        // 2. Subir a Gemini para extracción
        console.log(`   🧠 Subiendo a Gemini...`);
        const uploadResult = await fileManager.uploadFile(filePath, {
            mimeType: 'application/pdf',
            displayName: fileName,
        });
        aiFileRef = uploadResult.file;
        await waitForFileActive(aiFileRef.name);

        // 3. Prompt de extracción
        console.log(`   🤖 Ejecutando extracción con ${MODEL_NAME}...`);
        const model = ai.getGenerativeModel({
            model: MODEL_NAME,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: PROTOCOLO_SCHEMA as any,
                temperature: 0.1
            }
        });

        const prompt = `
            Eres un escribano experto leyendo tu Protocolo Histórico.
            Extrae la información fundamental de la siguiente escritura.
            Asegúrate de extraer con precisión el Número de Escritura, Fecha (YYYY-MM-DD), Tipo de Acto principal.
            Si no encuentras folio, CUIT u otros datos, déjalos como null.
        `;

        const result = await model.generateContent([
            { text: prompt },
            { fileData: { fileUri: aiFileRef.uri, mimeType: aiFileRef.mimeType } }
        ]);

        const textResponse = result.response.text();
        const extracted = JSON.parse(textResponse);

        console.log(`   ✅ Extracción exitosa. Acto: ${extracted.tipo_acto} | Nro: ${extracted.nro_escritura}`);

        // 4. Parsear fecha
        let dia = null;
        let mes = null;
        if (extracted.fecha) {
            const dateParts = extracted.fecha.split('-'); // YYYY-MM-DD
            if (dateParts.length >= 3) {
                mes = parseInt(dateParts[1], 10);
                dia = parseInt(dateParts[2], 10);
            }
        }

        // 5. Insertar en protocolo_registros
        console.log(`   💾 Insertando en protocolo_registros...`);
        const insertData = {
            anio,
            nro_escritura: extracted.nro_escritura || null,
            folios: extracted.folios || null,
            dia,
            mes,
            tipo_acto: extracted.tipo_acto || 'S/D',
            vendedor_acreedor: extracted.vendedor_acreedor || null,
            comprador_deudor: extracted.comprador_deudor || null,
            monto_ars: extracted.monto_ars || null,
            monto_usd: extracted.monto_usd || null,
            codigo_acto: extracted.codigo_acto || null,
            notas: extracted.observaciones_ia || null,
            es_errose: false,
            pdf_storage_path: uploadPath,
            extraction_status: 'COMPLETADO',
            extraction_data: extracted
        };

        let dbErr = null;
        if (insertData.nro_escritura) {
            const { data: existing } = await supabase
                .from('protocolo_registros')
                .select('id')
                .eq('nro_escritura', insertData.nro_escritura)
                .eq('anio', anio)
                .maybeSingle();

            if (existing) {
                const { error: updateErr } = await supabase
                    .from('protocolo_registros')
                    .update(insertData)
                    .eq('id', existing.id);
                dbErr = updateErr;
            } else {
                const { error: insertErr } = await supabase
                    .from('protocolo_registros')
                    .insert(insertData);
                dbErr = insertErr;
            }
        } else {
             const { error: insertErr } = await supabase
                .from('protocolo_registros')
                .insert(insertData);
             dbErr = insertErr;
        }

        if (dbErr) {
            throw new Error(`Error en DB: ${dbErr.message}`);
        }

        console.log(`   🎉 Guardado correctamente en la DB.`);

    } finally {
        // Limpieza Gemini
        if (aiFileRef) {
            try {
                await fileManager.deleteFile(aiFileRef.name);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    }
}

async function main() {
    const args = process.argv.slice(2);
    const desde = args[0] ? parseInt(args[0]) : null;
    const hasta = args[1] ? parseInt(args[1]) : null;

    if (!fs.existsSync(PDF_DIR)) {
        console.error(`❌ Directorio no encontrado: ${PDF_DIR}`);
        process.exit(1);
    }

    let pdfs = fs.readdirSync(PDF_DIR)
        .filter(f => f.toLowerCase().endsWith('.pdf'))
        .sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, '')) || 0;
            const numB = parseInt(b.replace(/\D/g, '')) || 0;
            return numA - numB;
        });

    if (desde !== null || hasta !== null) {
        pdfs = pdfs.filter(f => {
            const num = parseInt(f.replace(/\D/g, '')) || 0;
            if (desde !== null && num < desde) return false;
            if (hasta !== null && num > hasta) return false;
            return true;
        });
    }

    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  INGESTA DE ARCHIVO HISTÓRICO (PROTOCOLO 2026)   ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log();
    console.log(`📄 PDFs encontrados: ${pdfs.length}`);
    if (desde || hasta) console.log(`📋 Rango: ${desde || 1} - ${hasta || '∞'}`);
    console.log();

    let ok = 0;
    let failed = 0;
    const errors: string[] = [];
    const startTime = Date.now();

    for (let i = 0; i < pdfs.length; i++) {
        const pdfName = pdfs[i];
        const pdfPath = path.join(PDF_DIR, pdfName);
        console.log(`\n${'─'.repeat(55)}`);
        console.log(`[${i + 1}/${pdfs.length}] 📄 Procesando: ${pdfName}`);

        try {
            await procesarProtocolo(pdfPath, pdfName);
            ok++;
        } catch (err: any) {
            failed++;
            const msg = err.message || String(err);
            errors.push(`${pdfName}: ${msg}`);
            console.error(`   ❌ ERROR: ${msg}`);
        }

        if (i < pdfs.length - 1) {
            console.log(`   ⏸ Pausa ${DELAY_MS / 1000}s...`);
            await new Promise(r => setTimeout(r, DELAY_MS));
        }
    }

    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`\n${'═'.repeat(55)}`);
    console.log('RESUMEN DE INGESTA DE PROTOCOLOS');
    console.log(`${'═'.repeat(55)}`);
    console.log(`  ✅ Completados:         ${ok}`);
    console.log(`  ❌ Fallidos:            ${failed}`);
    console.log(`  ⏱  Tiempo total:        ${totalTime} min`);

    if (errors.length > 0) {
        console.log(`\n❌ Detalles de errores:`);
        errors.forEach(e => console.log(`   • ${e}`));
    }
}

main().catch(err => {
    console.error('💥 Error fatal:', err);
    process.exit(1);
});
