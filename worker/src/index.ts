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

            // 5. Guardar resultado de extracción (aún no marcamos completed)
            await supabase.from('ingestion_jobs').update({
                result_data: extractionResult.object,
                processing_metadata: { method: processingMethod, timestamp: new Date().toISOString() },
            }).eq('id', job.id);

            // 6. Insertar en tabla `escrituras` y tablas relacionadas para que la UI lo muestre
            const extractedData = extractionResult.object;

            // A. Insertar Inmueble
            let inmuebleId = null;
            if (extractedData.inmuebles && extractedData.inmuebles.length > 0) {
                const inmuebleToInsert = extractedData.inmuebles[0];
                const { data: insertedInmueble, error: inmuebleError } = await supabase.from('inmuebles').insert({
                    partido_id: '000',
                    nro_partida: '000000',
                    nomenclatura: inmuebleToInsert.nomenclatura || null,
                    transcripcion_literal: inmuebleToInsert.transcripcion_literal || null,
                }).select().single();

                if (inmuebleError) {
                    console.warn(`[WORKER] Warning insertando inmueble (continuando sin él):`, inmuebleError.message);
                } else if (insertedInmueble) {
                    inmuebleId = insertedInmueble.id;
                }
            }

            // B. Insertar Escritura
            let nro_protocolo = null;
            if (extractedData.numero_escritura) {
                const parsedInt = parseInt(extractedData.numero_escritura.replace(/\D/g, ''), 10);
                if (!isNaN(parsedInt)) nro_protocolo = parsedInt;
            }

            const { data: escrituraInsertada, error: insertError } = await supabase.from('escrituras').insert({
                carpeta_id: job.carpeta_id,
                nro_protocolo: nro_protocolo,
                fecha_escritura: extractedData.fecha_escritura || null,
                inmueble_princ_id: inmuebleId,
                pdf_url: job.file_path,
                analysis_metadata: {
                    tipo_acto_detectado: extractedData.resumen_acto,
                    datos_extraidos: extractedData
                }
            }).select().single();

            if (insertError || !escrituraInsertada) {
                const msg = `Error insertando escritura: ${insertError?.message || 'No data returned'}`;
                console.error(`[WORKER] ${msg}`);
                await supabase.from('ingestion_jobs').update({
                    status: 'failed',
                    error_message: msg,
                    finished_at: new Date().toISOString()
                }).eq('id', job.id);
                continue;
            }

            // C. Insertar Operación
            const { data: operacionInsertada, error: operacionError } = await supabase.from('operaciones').insert({
                escritura_id: escrituraInsertada.id,
                tipo_acto: extractedData.resumen_acto || 'SIN CLASIFICAR',
                monto_operacion: null
            }).select().single();

            if (operacionError) {
                console.error(`[WORKER] Error insertando operacion para Job ${job.id}:`, operacionError.message);
            } else if (operacionInsertada && extractedData.clientes) {
                // D. Insertar Personas y Participantes
                for (const cliente of extractedData.clientes) {
                    const dniFinal = cliente.dni || `SIN_DNI_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

                    const { error: personaError } = await supabase.from('personas').upsert({
                        dni: dniFinal,
                        nombre_completo: cliente.nombre_completo || 'SIN NOMBRE',
                        cuit: cliente.cuit || null,
                        tipo_persona: 'FISICA'
                    }, { onConflict: 'dni' });

                    if (personaError) {
                        console.error(`[WORKER] Error upserting persona ${cliente.nombre_completo}:`, personaError.message);
                    } else {
                        const { error: partError } = await supabase.from('participantes_operacion').insert({
                            operacion_id: operacionInsertada.id,
                            persona_id: dniFinal,
                            rol: cliente.rol || 'PARTE'
                        });
                        if (partError) {
                            console.error(`[WORKER] Error insertando participante ${cliente.nombre_completo}:`, partError.message);
                        }
                    }
                }
            }

            // 7. Todo OK → marcar como completed
            await supabase.from('ingestion_jobs').update({
                status: 'completed',
                finished_at: new Date().toISOString()
            }).eq('id', job.id);
            console.log(`[WORKER] Job ${job.id} COMPLETADO e insertado entidades vinculadas en BD.`);

        } catch (error: any) {
            console.error(`[WORKER] ERROR en Loop principal:`, error);
            // Intentar marcar el job actual como failed si tenemos referencia
            try {
                const { data: processingJobs } = await supabase
                    .from('ingestion_jobs')
                    .select('id')
                    .eq('status', 'processing')
                    .limit(1);
                if (processingJobs && processingJobs.length > 0) {
                    await supabase.from('ingestion_jobs').update({
                        status: 'failed',
                        error_message: error.message || 'Error desconocido en loop principal',
                        error_stack: error.stack || null,
                        finished_at: new Date().toISOString()
                    }).eq('id', processingJobs[0].id);
                }
            } catch (innerErr) {
                console.error(`[WORKER] No se pudo marcar job como failed:`, innerErr);
            }
            await new Promise(res => setTimeout(res, 5000));
        }
    }
}

// Iniciar
workerLoop();
