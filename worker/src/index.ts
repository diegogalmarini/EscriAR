import { createClient } from '@supabase/supabase-js';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { fromBuffer } from 'pdf2pic';
import * as dotenv from 'dotenv';
import { z } from 'zod';
const pdfParse = require('pdf-parse');

dotenv.config();

// Configuración Supabase
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuración Gemini
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });

// TODO: Extraer a un archivo de schemas compartido si es posible
const NotarySchema = z.object({
    resumen_acto: z.string().describe("El tipo de acto notarial (ej. COMPRAVENTA, PODER, DONACION)"),
    numero_escritura: z.string().nullable(),
    fecha_escritura: z.string().nullable(),
    clientes: z.array(z.object({
        rol: z.string(),
        nombre_completo: z.string(),
        dni: z.string().nullable(),
        cuit: z.string().nullable(),
    })),
    inmuebles: z.array(z.object({
        nomenclatura: z.string().nullable(),
        transcripcion_literal: z.string().nullable()
    })).optional()
}).describe("Datos extraídos de una escritura pública.");

async function extractTextFromBuffer(buffer: Buffer) {
    try {
        const data = await pdfParse(buffer);
        return data.text || '';
    } catch (e) {
        console.error("Error extracted text with pdf-parse", e);
        return '';
    }
}

async function convertPdfToImages(buffer: Buffer, limitPages: number) {
    const options = {
        density: 200,
        saveFilename: "page",
        savePath: "./temp", // Ensure temp directory exists or use buffer output
        format: "png",
        width: 1200,
        height: 1697
    };

    // We want to avoid saving to disk if possible, pdf2pic can return base64
    const storeAsImage = fromBuffer(buffer, { ...options });

    const results = [];
    // Convert first limits
    for (let i = 1; i <= limitPages; i++) {
        try {
            const result = await storeAsImage(i, { responseType: "buffer" });
            if (result && result.buffer) {
                results.push(result.buffer);
            }
        } catch (e) {
            console.log(`Página ${i} no procesada o no existe.`);
            break;
        }
    }
    return results;
}

const POLL_INTERVAL = Number(process.env.POLL_INTERVAL) || 3000;

async function workerLoop() {
    console.log(`[WORKER] Iniciando Node.js Worker (Hybrid Brain). Polling c/${POLL_INTERVAL}ms...`);

    while (true) {
        try {
            // 1. Fetch pending
            const { data: jobs, error: fetchError } = await supabase
                .from('ingestion_jobs')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: true })
                .limit(1);

            if (fetchError) throw fetchError;

            if (!jobs || jobs.length === 0) {
                await new Promise(res => setTimeout(res, POLL_INTERVAL));
                continue;
            }

            const job = jobs[0];
            console.log(`\n[WORKER] Agarrando Job: ${job.id} (${job.original_filename})`);

            // 2. Lock the job
            const { error: lockError } = await supabase
                .from('ingestion_jobs')
                .update({ status: 'processing', started_at: new Date().toISOString() })
                .eq('id', job.id)
                .eq('status', 'pending');

            if (lockError) {
                console.log(`[WORKER] Job ${job.id} tomado por otro thread. Omitiendo.`);
                continue;
            }

            // 3. Descargar archivo
            console.log(`[WORKER] Descargando de Storage: ${job.file_path}`);
            const { data: fileBlob, error: downloadError } = await supabase.storage
                .from('escrituras')
                .download(job.file_path);

            if (downloadError) throw new Error(`Error Storage: ${downloadError.message}`);

            const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());

            // 4. Intento rápido: Texto plano (pdf-parse)
            console.log(`[WORKER] Extrayendo texto...`);
            const textContent = await extractTextFromBuffer(fileBuffer);

            // Heurística de detección
            const isScannedImage = textContent.trim().length < 200;
            let extractionResult;
            let processingMethod = 'text-native';

            if (!isScannedImage) {
                console.log(`[WORKER] PDF Nativo detectado (${textContent.length} chars). Usando Solo-Texto.`);

                // Texto Nativo (Word->PDF)
                extractionResult = await generateObject({
                    model: google('gemini-3-flash-preview'),
                    prompt: `Eres un escribano experto. Extrae las entidades del texto:\n\n${textContent.substring(0, 150000)}`,
                    schema: NotarySchema
                });

            } else {
                console.log(`[WORKER] PDF Escaneado detectado. Iniciando VISION OCR.`);
                processingMethod = 'vision-ocr';

                const imageBuffers = await convertPdfToImages(fileBuffer, 6); // Primeras 6 pág.
                console.log(`[WORKER] Vision: Extraídas ${imageBuffers.length} imágenes.`);

                const contentParts: any[] = [
                    { type: 'text', text: 'Analiza estas imágenes de una escritura pública escaneada. Ignora manchas o ruido. Extrae los datos solicitados.' }
                ];

                for (const buf of imageBuffers) {
                    contentParts.push({ type: 'image', image: buf });
                }

                extractionResult = await generateObject({
                    model: google('gemini-3-flash-preview'),
                    messages: [{ role: 'user', content: contentParts }],
                    schema: NotarySchema
                });
            }

            console.log(`[WORKER] Extracción Finalizada con método: ${processingMethod}`);

            // 5. Success
            await supabase.from('ingestion_jobs').update({
                status: 'completed',
                result_data: extractionResult.object,
                processing_metadata: { method: processingMethod, timestamp: new Date().toISOString() },
                finished_at: new Date().toISOString()
            }).eq('id', job.id);

            console.log(`[WORKER] Job ${job.id} COMPLETADO.`);

        } catch (error: any) {
            console.error(`[WORKER] ERROR en Loop principal:`, error);
            await new Promise(res => setTimeout(res, 5000)); // Evitar fail-loop rapido
            // Deberíamos marcar el job como failed si estuviera procesando, 
            // pero para esta Demo simple el retry está en desarrollo.
        }
    }
}

// Iniciar
workerLoop();
