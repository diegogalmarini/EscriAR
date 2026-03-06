import { createClient } from '@supabase/supabase-js';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { fromBuffer } from 'pdf2pic';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import * as dotenv from 'dotenv';
import { z } from 'zod';
import * as http from 'http';
import * as fs from 'fs/promises';
import * as path from 'path';
import actsData from './acts_taxonomy_2026.json';
import { analyzeNote, NoteAnalysisOutputSchema } from './noteAnalyzer';
import { extractCertificate } from './certExtractor';
const pdfParse = require('pdf-parse');

dotenv.config();

// --- Gemini File API Manager (for full PDF upload) ---
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!);

// --- CESBA Code Assignment (deterministic, using official taxonomy JSON) ---
// Mapeo verificado de texto libre de Gemini → código CESBA oficial
// Cada código fue validado contra acts_taxonomy_2026.json
const ACT_TYPE_MAP: Record<string, string> = {
    'COMPRAVENTA': '100-00',
    'VENTA': '100-00',
    'COMPRA': '100-00',
    'DACION EN PAGO': '100-00',
    'COMPRAVENTA DE NUDA PROPIEDAD': '103-00',
    'HIPOTECA': '300-00',
    'PRESTAMO HIPOTECARIO': '300-00',
    'MUTUO HIPOTECARIO': '300-00',
    'MUTUO': '300-00',
    'CREDITO HIPOTECARIO': '300-00',
    'PRESTAMO': '300-00',
    'PRESTAMO BANCARIO': '300-00',
    'CONTRATO DE CREDITO': '300-00',
    'CANCELACION DE HIPOTECA': '311-00',
    'CANCELACION': '311-00',
    'LEVANTAMIENTO DE HIPOTECA': '311-00',
    'DONACION': '200-30',
    'CESION': '834-00',
    'CESION DE DERECHOS': '834-00',
    'CESION DE DERECHOS Y ACCIONES': '834-00',
    'FIDEICOMISO': '121-00',
    'TRANSFERENCIA DE DOMINIO A BENEFICIARIO': '121-00',
    'ADJUDICACION DE FIDEICOMISO': '121-00',
    'USUFRUCTO': '400-00',
    'CONSTITUCION DE USUFRUCTO': '400-00',
    'REGLAMENTO DE PROPIEDAD HORIZONTAL': '512-30',
    'REGLAMENTO DE PH': '512-30',
    'AFECTACION A PROPIEDAD HORIZONTAL': '512-30',
    'DIVISION DE CONDOMINIO': '512-30',
    'MODIFICACION DE REGLAMENTO': '513-30',
    'AFECTACION BIEN DE FAMILIA': '500-32',
    'AFECTACION A VIVIENDA': '500-32',
};

function getCESBACode(tipoActo: string): string | null {
    if (!tipoActo) return null;
    const normalized = (tipoActo || '')
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toUpperCase().trim();

    const acts = actsData as Record<string, any>;

    // 1. Exact match en mapeo verificado
    if (ACT_TYPE_MAP[normalized] && acts[ACT_TYPE_MAP[normalized]]) {
        return ACT_TYPE_MAP[normalized];
    }

    // 2. Partial match en mapeo (Gemini puede devolver variantes)
    for (const [key, code] of Object.entries(ACT_TYPE_MAP)) {
        if (normalized.includes(key) && acts[code]) return code;
    }

    // 3. Búsqueda exacta en descriptions del JSON de taxonomía
    for (const [code, act] of Object.entries(acts)) {
        const desc = ((act as any).description || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
        if (desc === normalized) return code;
    }

    // 4. Partial match en descriptions del JSON
    for (const [code, act] of Object.entries(acts)) {
        const desc = ((act as any).description || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
        if (normalized.length > 4 && (desc.includes(normalized) || normalized.includes(desc))) return code;
    }

    return null;
}

// Servidor Dummy HTTP para Railway Healthcheck
const port = process.env.PORT || 8080;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('NotiAR Worker is running\n');
}).listen(port, () => {
    console.log(`[WORKER] Healthcheck server listening on port ${port}`);
});

// Configuración Supabase
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuración Gemini
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });

// Schema completo alineado con el frontend (src/lib/aiConfig.ts)
const NotarySchema = z.object({
    resumen_acto: z.string().describe("Tipo de acto notarial: COMPRAVENTA, PODER, DONACION, HIPOTECA, CESION, REGLAMENTO DE PROPIEDAD HORIZONTAL, etc."),
    numero_escritura: z.string().nullable().describe("Número de escritura/protocolo"),
    fecha_escritura: z.string().nullable().describe("Fecha de la escritura en formato YYYY-MM-DD"),
    escribano: z.string().nullable().describe("Nombre completo del escribano/notario interviniente"),
    registro: z.string().nullable().describe("Número de registro del escribano"),
    monto_operacion: z.number().nullable().describe("Monto/precio de la operación en pesos argentinos"),
    clientes: z.array(z.object({
        rol: z.string().describe("VENDEDOR, COMPRADOR, CEDENTE, CESIONARIO, ACREEDOR, DEUDOR, CONDOMINO, FIADOR, APODERADO, DONANTE, DONATARIO, etc."),
        tipo_persona: z.string().describe("FISICA, JURIDICA o FIDEICOMISO").default("FISICA"),
        nombre_completo: z.string().describe("Nombre y apellido completo. Apellido en MAYÚSCULAS"),
        dni: z.string().nullable().describe("DNI: solo dígitos con puntos (ej. 11.341.571)"),
        cuit: z.string().nullable().describe("CUIT/CUIL en formato XX-XXXXXXXX-X con guiones"),
        nacionalidad: z.string().nullable().describe("Nacionalidad (ej. Argentina)"),
        fecha_nacimiento: z.string().nullable().describe("Fecha de nacimiento YYYY-MM-DD"),
        estado_civil: z.string().nullable().describe("Estado civil: Soltero/a, Casado/a, Viudo/a, Divorciado/a"),
        domicilio: z.string().nullable().describe("Domicilio real completo literal"),
        nombres_padres: z.string().nullable().describe("Filiación: ej. 'hijo de Juan PEREZ y Maria GOMEZ'"),
        conyuge_nombre: z.string().nullable().describe("Nombre completo del cónyuge si se menciona"),
        conyuge_dni: z.string().nullable().describe("DNI del cónyuge si se menciona"),
        poder_detalle: z.string().nullable().describe("Solo para APODERADOS: texto completo del poder que lo habilita. Ej: 'poder general amplio conferido por escritura número 100 de fecha 21/03/2018, ante escribano Santiago Alvarez Fourcade, folio 733'").optional(),
    })),
    inmuebles: z.array(z.object({
        partido: z.string().nullable().describe("Nombre del partido/departamento (ej. MONTE HERMOSO, BAHIA BLANCA)"),
        partida_inmobiliaria: z.string().nullable().describe("Número de partida inmobiliaria"),
        nomenclatura: z.string().nullable().describe("Nomenclatura catastral completa"),
        transcripcion_literal: z.string().nullable().describe("Copia LITERAL COMPLETA de la descripción del inmueble: ubicación, medidas, linderos, superficie. NO incluir título antecedente."),
        titulo_antecedente: z.string().nullable().describe("Sección 'TITULO ANTECEDENTE' o 'Les corresponde...' hasta inscripción registral"),
        valuacion_fiscal: z.number().nullable().describe("Valuación fiscal en pesos"),
    })).optional()
}).describe("Datos extraídos de una escritura pública argentina.");

const EXTRACTION_PROMPT = `Eres un escribano argentino experto. Extrae TODOS los datos de esta escritura pública.

REGLAS CRÍTICAS:
1. NOMBRES: Detecta nombres compuestos. Apellidos en MAYÚSCULAS (ej. "Raúl Ernesto COLANTONIO").
2. DNI: Con puntos (ej. "11.341.571"). CUIT/CUIL: Formato XX-XXXXXXXX-X con guiones.
3. BANCOS Y ENTIDADES: Si dice "en representación de BANCO X", extrae DOS entidades: el banco (JURIDICA, rol ACREEDOR) y el representante (FISICA, rol APODERADO). Para el APODERADO, extrae en poder_detalle el texto completo del poder: tipo (general/especial), escritura número, fecha, escribano otorgante, folio, registro.
4. CÓNYUGES: Si dice "casado/a con X", extrae nombre y DNI del cónyuge.
5. INMUEBLES - TRANSCRIPCIÓN LITERAL: Copia EXACTA de la descripción del inmueble desde ubicación, incluyendo medidas, linderos, nomenclatura catastral, superficie y valuación fiscal. NO incluir título antecedente.
6. TITULO ANTECEDENTE: Campo SEPARADO. Desde "Les corresponde..." o "Le corresponde..." hasta inscripción registral.
7. PARTIDO: Nombre del partido (ej. "MONTE HERMOSO", "BAHIA BLANCA"), NO código numérico.
8. ESCRIBANO Y REGISTRO: Extrae el nombre del escribano y su número de registro.
9. ESTADO CIVIL: Extrae si se menciona (Soltero/a, Casado/a, Viudo/a, Divorciado/a).
10. FILIACIÓN: Si dice "hijo de X e Y", extrae en nombres_padres.
11. DOMICILIO: Dirección completa literal.
12. NACIONALIDAD Y FECHA NACIMIENTO: Extrae si aparecen.
13. Si un dato NO aparece en el documento, dejarlo como null. NO inventar datos.

TEXTO DE LA ESCRITURA:
`;

const VISION_PROMPT = `Eres un escribano argentino experto. Analiza estas imágenes de una escritura pública escaneada. Ignora manchas o ruido. Extrae TODOS los datos posibles.

REGLAS: Nombres con apellido en MAYÚSCULAS. DNI con puntos. CUIT con guiones XX-XXXXXXXX-X. Transcripción literal del inmueble COMPLETA. Extraer escribano, registro, estado civil, filiación, domicilio, nacionalidad, cónyuge. Si un dato no aparece, dejarlo null.`;

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
            // 1. Fetch pending (both INGEST and NOTE_ANALYSIS)
            const { data: jobs, error: fetchError } = await supabase
                .from('ingestion_jobs')
                .select('*')
                .eq('status', 'pending')
                .in('job_type', ['INGEST', 'NOTE_ANALYSIS', 'CERT_EXTRACT'])
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

            // ── NOTE_ANALYSIS: procesar con Gemini Flash ──
            if (job.job_type === 'NOTE_ANALYSIS') {
                await processNoteAnalysis(job);
                continue;
            }

            // ── CERT_EXTRACT: extraer datos de certificado con Gemini Pro ──
            if (job.job_type === 'CERT_EXTRACT') {
                await processCertExtraction(job);
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
                    prompt: EXTRACTION_PROMPT + textContent.substring(0, 150000),
                    schema: NotarySchema
                });

            } else {
                console.log(`[WORKER] PDF Escaneado detectado. Usando Gemini File API para documento completo.`);
                processingMethod = 'file-api-vision';

                // Escribir buffer a archivo temporal para subir via File API
                const tempDir = process.env.TEMP || '/tmp';
                const tempPath = path.join(tempDir, `worker_${job.id}.pdf`);
                await fs.writeFile(tempPath, fileBuffer);

                let geminiFileName: string | null = null;
                try {
                    // Subir PDF completo a Gemini File API
                    const uploadResponse = await fileManager.uploadFile(tempPath, {
                        mimeType: 'application/pdf',
                        displayName: job.original_filename || `job_${job.id}.pdf`,
                    });

                    // Esperar a que Gemini termine de procesar el archivo
                    let uploadedFile = uploadResponse.file;
                    geminiFileName = uploadedFile.name;
                    while (uploadedFile.state === 'PROCESSING') {
                        await new Promise(r => setTimeout(r, 2000));
                        const fileStatus = await fileManager.getFile(uploadedFile.name);
                        uploadedFile = fileStatus;
                    }

                    if (uploadedFile.state === 'FAILED') {
                        throw new Error('Gemini File API: el archivo falló al procesarse');
                    }

                    console.log(`[WORKER] File API: archivo listo (${uploadedFile.uri}). Extrayendo con Gemini...`);

                    // Enviar como FilePart con URL — @ai-sdk/google lo convierte a fileData internamente
                    extractionResult = await generateObject({
                        model: google('gemini-3-flash-preview'),
                        messages: [{
                            role: 'user',
                            content: [
                                { type: 'text', text: VISION_PROMPT },
                                { type: 'file', data: new URL(uploadedFile.uri), mediaType: 'application/pdf' }
                            ]
                        }],
                        schema: NotarySchema
                    });
                } finally {
                    // SEGURIDAD: Purgar PDF de servidores Google (incluso si generateObject falla)
                    if (geminiFileName) {
                        await fileManager.deleteFile(geminiFileName).catch(() => {});
                    }
                    // Limpiar archivo temporal del disco
                    await fs.unlink(tempPath).catch(() => {});
                }
            }

            console.log(`[WORKER] Extracción Finalizada con método: ${processingMethod}`);

            // 5. Guardar resultado de extracción (aún no marcamos completed)
            await supabase.from('ingestion_jobs').update({
                result_data: extractionResult.object,
                processing_metadata: { method: processingMethod, timestamp: new Date().toISOString() },
            }).eq('id', job.id);

            // 6. Insertar en tabla `escrituras` y tablas relacionadas para que la UI lo muestre
            const extractedData = extractionResult.object;

            // A. Insertar Inmueble (DEDUP: check by partido_id + nro_partida)
            // Normalize helpers (inline since worker is a separate project)
            const normPartido = (p: string) => {
                const accentMap: Record<string, string> = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u' };
                const stripped = (p || 'Sin Partido').trim().toLowerCase().replace(/[áéíóúü]/g, c => accentMap[c] || c);
                return stripped.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            };
            const normPartida = (p: string) => (p || '000000').trim().replace(/\./g, '');

            let inmuebleId = null;
            if (extractedData.inmuebles && extractedData.inmuebles.length > 0) {
                const inm = extractedData.inmuebles[0];
                const partidoId = normPartido(inm.partido || 'Sin Partido');
                const nroPartida = normPartida(inm.partida_inmobiliaria || '000000');

                // Check if inmueble already exists
                if (nroPartida && nroPartida !== '000000') {
                    const { data: existingInm } = await supabase.from('inmuebles')
                        .select('id')
                        .eq('partido_id', partidoId)
                        .eq('nro_partida', nroPartida)
                        .maybeSingle();
                    if (existingInm) {
                        inmuebleId = existingInm.id;
                        console.log(`[WORKER] ♻️ Inmueble ${partidoId}/${nroPartida} ya existe (${inmuebleId}), reutilizando`);
                    }
                }

                if (!inmuebleId) {
                    const { data: insertedInmueble, error: inmuebleError } = await supabase.from('inmuebles').insert({
                        partido_id: partidoId,
                        nro_partida: nroPartida,
                        nomenclatura: inm.nomenclatura || null,
                        transcripcion_literal: inm.transcripcion_literal || null,
                        titulo_antecedente: inm.titulo_antecedente || null,
                        valuacion_fiscal: inm.valuacion_fiscal || null,
                    }).select().single();

                    if (inmuebleError) {
                        console.warn(`[WORKER] Warning insertando inmueble (continuando sin él):`, inmuebleError.message);
                    } else if (insertedInmueble) {
                        inmuebleId = insertedInmueble.id;
                    }
                }
            }

            // B. Insertar Escritura (con escribano y registro)
            let nro_protocolo = null;
            if (extractedData.numero_escritura) {
                const parsedInt = parseInt(extractedData.numero_escritura.replace(/\D/g, ''), 10);
                if (!isNaN(parsedInt)) nro_protocolo = parsedInt;
            }

            // DEDUP: Check if escritura with same protocolo+registro already exists
            let escrituraInsertada: any = null;
            const registro = extractedData.registro ? String(extractedData.registro) : null;

            if (nro_protocolo && registro) {
                const { data: existingEsc } = await supabase.from('escrituras')
                    .select('*, operaciones(id)')
                    .eq('nro_protocolo', nro_protocolo)
                    .eq('registro', registro)
                    .maybeSingle();
                if (existingEsc) {
                    console.log(`[WORKER] ♻️ Escritura ${nro_protocolo}/${registro} ya existe (${existingEsc.id}), actualizando metadata`);
                    await supabase.from('escrituras').update({
                        analysis_metadata: { tipo_acto_detectado: extractedData.resumen_acto, datos_extraidos: extractedData },
                        pdf_url: job.file_path,
                        inmueble_princ_id: inmuebleId || existingEsc.inmueble_princ_id
                    }).eq('id', existingEsc.id);
                    escrituraInsertada = existingEsc;
                }
            }

            if (!escrituraInsertada) {
                const { data: newEsc, error: insertError } = await supabase.from('escrituras').insert({
                    carpeta_id: job.carpeta_id,
                    nro_protocolo: nro_protocolo,
                    fecha_escritura: extractedData.fecha_escritura || null,
                    registro: registro,
                    notario_interviniente: extractedData.escribano || null,
                    inmueble_princ_id: inmuebleId,
                    pdf_url: job.file_path,
                    analysis_metadata: {
                        tipo_acto_detectado: extractedData.resumen_acto,
                        datos_extraidos: extractedData
                    }
                }).select().single();

                if (insertError || !newEsc) {
                    const msg = `Error insertando escritura: ${insertError?.message || 'No data returned'}`;
                    console.error(`[WORKER] ${msg}`);
                    await supabase.from('ingestion_jobs').update({
                        status: 'failed',
                        error_message: msg,
                        finished_at: new Date().toISOString()
                    }).eq('id', job.id);
                    continue;
                }
                escrituraInsertada = newEsc;
            }

            // C. Insertar Operación (DEDUP: reuse if escritura already has one)
            const codigoCESBA = getCESBACode(extractedData.resumen_acto || '');
            console.log(`[WORKER] Tipo acto: "${extractedData.resumen_acto}" → Código CESBA: ${codigoCESBA || 'null'}`);

            let operacionInsertada: any = null;
            const existingOps = escrituraInsertada.operaciones || [];
            if (existingOps.length > 0) {
                operacionInsertada = existingOps[0];
                console.log(`[WORKER] ♻️ Operación ya existe (${operacionInsertada.id}), actualizando`);
                await supabase.from('operaciones').update({
                    tipo_acto: extractedData.resumen_acto || 'SIN CLASIFICAR',
                    monto_operacion: extractedData.monto_operacion || null,
                    codigo: codigoCESBA
                }).eq('id', operacionInsertada.id);
            } else {
                const { data: newOp, error: operacionError } = await supabase.from('operaciones').insert({
                    escritura_id: escrituraInsertada.id,
                    tipo_acto: extractedData.resumen_acto || 'SIN CLASIFICAR',
                    monto_operacion: extractedData.monto_operacion || null,
                    codigo: codigoCESBA
                }).select().single();
                if (operacionError) {
                    console.error(`[WORKER] Error insertando operacion para Job ${job.id}:`, operacionError.message);
                }
                operacionInsertada = newOp;
            }

            if (operacionInsertada && extractedData.clientes) {
                // D. Insertar Personas y Participantes (con todos los campos biográficos)
                // First pass: collect client metadata for representación inference
                const clientMeta: { dniFinal: string; nombre: string; rol: string; tipo: string; poderDetalle: string | null }[] = [];

                for (const cliente of extractedData.clientes) {
                    const rawDni = cliente.dni?.replace(/[^a-zA-Z0-9]/g, '') || '';
                    const rawCuit = cliente.cuit?.replace(/[^a-zA-Z0-9]/g, '') || '';

                    // Detect tipo_persona from CUIT prefix or name
                    let tipoPersona = cliente.tipo_persona || 'FISICA';
                    const cuitPrefix = (rawCuit || rawDni).substring(0, 2);
                    if (['30', '33', '34'].includes(cuitPrefix)) tipoPersona = 'JURIDICA';
                    const upperName = (cliente.nombre_completo || '').toUpperCase();
                    if (upperName.includes('BANCO') || upperName.includes('S.A.') || upperName.includes('S.R.L.') || upperName.includes('FIDEICOMISO')) tipoPersona = 'JURIDICA';

                    // For JURIDICA: CUIT IS the ID (they don't have DNI)
                    // For FISICA: DNI first, CUIT as fallback
                    let dniFinal = '';
                    if (tipoPersona === 'JURIDICA' || tipoPersona === 'FIDEICOMISO') {
                        dniFinal = rawCuit || rawDni || '';
                    } else {
                        dniFinal = rawDni || rawCuit || '';
                    }

                    // If still no ID, check if persona already exists by CUIT before generating SIN_DNI
                    if (!dniFinal && rawCuit) {
                        const { data: existingByCuit } = await supabase.from('personas').select('dni').eq('cuit', rawCuit).maybeSingle();
                        if (existingByCuit) dniFinal = existingByCuit.dni;
                    }
                    if (!dniFinal) {
                        dniFinal = `SIN_DNI_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                    }

                    clientMeta.push({ dniFinal, nombre: cliente.nombre_completo || 'SIN NOMBRE', rol: (cliente.rol || 'PARTE').toUpperCase(), tipo: tipoPersona, poderDetalle: cliente.poder_detalle || null });

                    const personaData: any = {
                        dni: dniFinal,
                        nombre_completo: cliente.nombre_completo || 'SIN NOMBRE',
                        cuit: rawCuit || null,
                        tipo_persona: tipoPersona,
                        nacionalidad: cliente.nacionalidad || null,
                        fecha_nacimiento: cliente.fecha_nacimiento || null,
                        estado_civil_detalle: cliente.estado_civil || null,
                        domicilio_real: cliente.domicilio ? { literal: cliente.domicilio } : {},
                        nombres_padres: cliente.nombres_padres || null,
                        origen_dato: 'IA_OCR',
                        updated_at: new Date().toISOString(),
                    };

                    // Datos del cónyuge si están presentes
                    if (cliente.conyuge_nombre) {
                        personaData.datos_conyuge = {
                            nombre: cliente.conyuge_nombre,
                            dni: cliente.conyuge_dni || null,
                        };
                    }

                    const { error: personaError } = await supabase.from('personas').upsert(
                        personaData,
                        { onConflict: 'dni' }
                    );

                    if (personaError) {
                        console.error(`[WORKER] Error upserting persona ${cliente.nombre_completo}:`, personaError.message);
                    } else {
                        // DEDUP: upsert with ON CONFLICT DO NOTHING for unique constraint
                        const { error: partError } = await supabase.from('participantes_operacion').upsert({
                            operacion_id: operacionInsertada.id,
                            persona_id: dniFinal,
                            rol: cliente.rol || 'PARTE'
                        }, { onConflict: 'operacion_id,persona_id', ignoreDuplicates: true });
                        if (partError) {
                            console.error(`[WORKER] Error insertando participante ${cliente.nombre_completo}:`, partError.message);
                        }
                    }
                }

                // E. REPRESENTACIÓN INFERENCE: Link APODERADO participants to JURIDICA entities
                const juridicas = clientMeta.filter(c => c.tipo === 'JURIDICA' || c.tipo === 'FIDEICOMISO');
                const apoderados = clientMeta.filter(c => c.rol.includes('APODERADO') || c.rol.includes('REPRESENTANTE') || c.rol.includes('MANDATARIO'));

                if (apoderados.length > 0 && juridicas.length > 0) {
                    const target = juridicas.length === 1
                        ? juridicas[0]
                        : juridicas.find(j => j.rol.includes('ACREEDOR')) || juridicas[0];

                    for (const apod of apoderados) {
                        const repData = {
                            representa_a: target.nombre,
                            caracter: 'Apoderado',
                            poder_detalle: apod.poderDetalle || null
                        };
                        console.log(`[WORKER] Representación: ${apod.nombre} → represents ${target.nombre}`);
                        await supabase.from('participantes_operacion').update({
                            datos_representacion: repData
                        }).eq('operacion_id', operacionInsertada.id).eq('persona_id', apod.dniFinal);
                    }
                }
            }

            // 7. Todo OK → marcar como completed
            await supabase.from('ingestion_jobs').update({
                status: 'completed',
                finished_at: new Date().toISOString()
            }).eq('id', job.id);

            // 8. Actualizar carpeta → COMPLETADO (dispara realtime refresh en frontend)
            if (job.carpeta_id) {
                await supabase.from('carpetas').update({
                    ingesta_estado: 'COMPLETADO',
                    ingesta_paso: `Worker: extracción completada`,
                }).eq('id', job.carpeta_id);
            }

            console.log(`[WORKER] Job ${job.id} COMPLETADO e insertado entidades vinculadas en BD.`);

        } catch (error: any) {
            console.error(`[WORKER] ERROR en Loop principal:`, error);
            // Intentar marcar el job actual como failed si tenemos referencia
            try {
                const { data: processingJobs } = await supabase
                    .from('ingestion_jobs')
                    .select('id, carpeta_id')
                    .eq('status', 'processing')
                    .limit(1);
                if (processingJobs && processingJobs.length > 0) {
                    await supabase.from('ingestion_jobs').update({
                        status: 'failed',
                        error_message: error.message || 'Error desconocido en loop principal',
                        error_stack: error.stack || null,
                        finished_at: new Date().toISOString()
                    }).eq('id', processingJobs[0].id);

                    // Actualizar carpeta → ERROR
                    if (processingJobs[0].carpeta_id) {
                        await supabase.from('carpetas').update({
                            ingesta_estado: 'ERROR',
                            ingesta_paso: `Worker error: ${error.message || 'desconocido'}`,
                        }).eq('id', processingJobs[0].carpeta_id);
                    }
                }
            } catch (innerErr) {
                console.error(`[WORKER] No se pudo marcar job como failed:`, innerErr);
            }
            await new Promise(res => setTimeout(res, 5000));
        }
    }
}

// ── NOTE_ANALYSIS handler ──
async function processNoteAnalysis(job: any) {
    const apunteId = job.entity_ref?.apunte_id;
    if (!apunteId) {
        console.error(`[WORKER] NOTE_ANALYSIS job ${job.id}: sin apunte_id en entity_ref`);
        await supabase.from('ingestion_jobs').update({
            status: 'failed',
            error_message: 'entity_ref.apunte_id faltante',
            finished_at: new Date().toISOString(),
        }).eq('id', job.id);
        return;
    }

    console.log(`[WORKER] NOTE_ANALYSIS: Analizando apunte ${apunteId}`);

    try {
        // 1. Obtener texto del apunte
        const { data: apunte, error: fetchErr } = await supabase
            .from('apuntes')
            .select('contenido, carpeta_id, org_id')
            .eq('id', apunteId)
            .single();

        if (fetchErr || !apunte) {
            throw new Error(`Apunte ${apunteId} no encontrado: ${fetchErr?.message || 'sin data'}`);
        }

        // 2. Ejecutar análisis con Gemini Flash
        const geminiKey = process.env.GEMINI_API_KEY!;
        console.log(`[WORKER] NOTE_ANALYSIS: texto="${apunte.contenido.substring(0, 200)}"`);
        const analysis = await analyzeNote(apunte.contenido, geminiKey);

        console.log(`[WORKER] NOTE_ANALYSIS: raw analysis=`, JSON.stringify(analysis).substring(0, 500));

        const sugerencias = analysis.sugerencias || [];
        console.log(`[WORKER] NOTE_ANALYSIS: ${sugerencias.length} sugerencias generadas`);

        // 4. Insertar sugerencias en BD
        if (sugerencias.length > 0) {
            const rows = sugerencias.map(s => ({
                org_id: apunte.org_id,
                carpeta_id: apunte.carpeta_id,
                apunte_id: apunteId,
                tipo: s.tipo,
                payload: s.payload,
                evidencia_texto: s.evidencia_texto,
                confianza: s.confianza,
                estado: 'PROPOSED',
            }));

            const { error: insertErr } = await supabase
                .from('sugerencias')
                .insert(rows);

            if (insertErr) {
                throw new Error(`Error insertando sugerencias: ${insertErr.message}`);
            }
        }

        // 5. Marcar apunte como COMPLETADO
        await supabase.from('apuntes').update({
            ia_status: 'COMPLETADO',
            ia_last_error: null,
        }).eq('id', apunteId);

        // 6. Marcar job como completed
        await supabase.from('ingestion_jobs').update({
            status: 'completed',
            result_data: { sugerencias_count: sugerencias.length },
            finished_at: new Date().toISOString(),
        }).eq('id', job.id);

        console.log(`[WORKER] NOTE_ANALYSIS job ${job.id} COMPLETADO: ${sugerencias.length} sugerencias`);

    } catch (error: any) {
        console.error(`[WORKER] NOTE_ANALYSIS job ${job.id} FAILED:`, error.message);

        // Marcar apunte como ERROR
        await supabase.from('apuntes').update({
            ia_status: 'ERROR',
            ia_last_error: error.message?.substring(0, 500) || 'Error desconocido',
        }).eq('id', apunteId);

        // Marcar job como failed
        await supabase.from('ingestion_jobs').update({
            status: 'failed',
            error_message: error.message || 'Error desconocido',
            finished_at: new Date().toISOString(),
        }).eq('id', job.id);
    }
}

// ── CERT_EXTRACT: Extracción de certificados notariales ──

async function processCertExtraction(job: any) {
    const certId = job.entity_ref?.certificado_id;
    const tipoCert = job.entity_ref?.tipo || 'OTRO';

    if (!certId) {
        console.error(`[WORKER] CERT_EXTRACT job ${job.id}: sin certificado_id en entity_ref`);
        await supabase.from('ingestion_jobs').update({
            status: 'failed',
            error_message: 'entity_ref.certificado_id faltante',
            finished_at: new Date().toISOString(),
        }).eq('id', job.id);
        return;
    }

    console.log(`[WORKER] CERT_EXTRACT: Procesando certificado ${certId} (tipo: ${tipoCert})`);

    try {
        // 1. Marcar certificado como PROCESANDO
        await supabase.from('certificados').update({
            extraction_status: 'PROCESANDO',
            extraction_error: null,
        }).eq('id', certId);

        // 2. Descargar archivo del storage
        const bucket = job.file_path?.includes('/') ? 'certificados' : 'escrituras';
        console.log(`[WORKER] CERT_EXTRACT: Descargando de ${bucket}: ${job.file_path}`);

        const { data: fileBlob, error: dlErr } = await supabase.storage
            .from(bucket)
            .download(job.file_path);

        if (dlErr) throw new Error(`Error descargando archivo: ${dlErr.message}`);
        const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());

        // 3. Determinar si es PDF nativo o escaneado
        let textContent: string | null = null;
        let imageBuffers: Buffer[] | null = null;

        const isPdf = job.file_path?.toLowerCase().endsWith('.pdf') ||
                       job.original_filename?.toLowerCase().endsWith('.pdf');

        if (isPdf) {
            const pdfParse = require('pdf-parse');
            try {
                const parsed = await pdfParse(fileBuffer);
                textContent = parsed.text || '';
            } catch {
                textContent = '';
            }

            // Si poco texto, convertir a imágenes
            if (!textContent || textContent.trim().length < 200) {
                console.log(`[WORKER] CERT_EXTRACT: PDF escaneado, convirtiendo a imágenes...`);
                textContent = null;
                imageBuffers = await convertPdfToImages(fileBuffer, 5);
            }
        } else {
            // Es imagen directa (PNG/JPG)
            imageBuffers = [fileBuffer];
        }

        // 4. Extraer con Gemini Pro
        const geminiKey = process.env.GEMINI_API_KEY!;
        const result = await extractCertificate(textContent, imageBuffers, tipoCert, geminiKey);

        console.log(`[WORKER] CERT_EXTRACT: Extracción exitosa. Campos: ${Object.keys(result.datos).filter(k => (result.datos as any)[k] !== null).join(', ')}`);

        // 5. Guardar resultados en certificado
        const updateData: Record<string, any> = {
            extraction_status: 'COMPLETADO',
            extraction_data: result.datos,
            extraction_evidence: { fragmentos: result.evidencia },
            extraction_error: null,
        };

        // Auto-rellenar campos canónicos SOLO si están vacíos (no sobreescribir datos manuales)
        const { data: currentCert } = await supabase.from('certificados')
            .select('fecha_vencimiento, nro_certificado, organismo')
            .eq('id', certId).single();

        if (!currentCert?.fecha_vencimiento && result.datos.fecha_vencimiento) {
            updateData.fecha_vencimiento = result.datos.fecha_vencimiento;
        }
        if (!currentCert?.nro_certificado && result.datos.numero_certificado) {
            updateData.nro_certificado = result.datos.numero_certificado;
        }
        if (!currentCert?.organismo && result.datos.organismo) {
            updateData.organismo = result.datos.organismo;
        }

        await supabase.from('certificados').update(updateData).eq('id', certId);

        // 6. Marcar job como completed
        await supabase.from('ingestion_jobs').update({
            status: 'completed',
            result_data: { campos_extraidos: Object.keys(result.datos).filter(k => (result.datos as any)[k] !== null).length },
            finished_at: new Date().toISOString(),
        }).eq('id', job.id);

        console.log(`[WORKER] CERT_EXTRACT job ${job.id} COMPLETADO`);

    } catch (error: any) {
        console.error(`[WORKER] CERT_EXTRACT job ${job.id} FAILED:`, error.message);

        await supabase.from('certificados').update({
            extraction_status: 'ERROR',
            extraction_error: error.message?.substring(0, 500) || 'Error desconocido',
        }).eq('id', certId);

        await supabase.from('ingestion_jobs').update({
            status: 'failed',
            error_message: error.message || 'Error desconocido',
            finished_at: new Date().toISOString(),
        }).eq('id', job.id);
    }
}

// Iniciar
workerLoop();
