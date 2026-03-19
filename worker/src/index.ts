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
import { extractEscritura } from './escrituraExtractor';
import { resolveJurisdiction } from './jurisdictionResolver';
const pdfParse = require('pdf-parse');

dotenv.config();

// --- Gemini File API Manager (for full PDF upload) ---
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!);

// --- CESBA Code Assignment (deterministic, regex rules from actClassifier) ---
// 147+ regex rules mapping free-form notarial act descriptions to CESBA codes.
// Rules are ordered: most specific first. Compound acts use " / ".

type ClassifierRule = { pattern: RegExp; code: string };

const CLASSIFIER_RULES: ClassifierRule[] = [
    // ── Escrituras anuladas / no pasadas ──
    { pattern: /no\s*pas[oó]/i, code: "999-00" },
    { pattern: /anulad[ao]/i, code: "999-00" },
    { pattern: /errose/i, code: "999-00" },

    // ── Compuestos (venta + algo) — must be before simple venta ──
    { pattern: /venta.*t\.?\s*a\.?|compraventa.*tracto/i, code: "100-00 / 713-00" },
    { pattern: /venta.*ext\.?\s*usuf/i, code: "100-00 / 401-30" },
    { pattern: /venta.*renun.*usuf/i, code: "100-00 / 414-30" },
    { pattern: /venta.*cancel.*hip/i, code: "100-00 / 311-00" },
    { pattern: /venta.*hip[oó]t/i, code: "100-00 / 300-00" },

    // ── Compraventas ──
    { pattern: /compraventa|^venta\b/i, code: "100-00" },

    // ── Tracto abreviado (solo) ──
    { pattern: /tracto\s*abrev/i, code: "713-00" },

    // ── Donaciones ──
    { pattern: /donac/i, code: "200-30" },

    // ── Hipotecas (specific before generic) ──
    { pattern: /cancel.*hip[oó]t/i, code: "311-00" },
    { pattern: /cont.*cr[eé]d.*hip|hip[oó]t.*cr[eé]d|const.*hip/i, code: "300-22" },
    { pattern: /hip[oó]t/i, code: "300-00" },

    // ── Usufructo ──
    { pattern: /renun.*usuf/i, code: "414-30" },
    { pattern: /ext.*usuf/i, code: "401-30" },
    { pattern: /const.*usuf|usufruct/i, code: "400-00" },

    // ── Vivienda ──
    { pattern: /desaf.*vivien/i, code: "501-32" },
    { pattern: /afect.*vivien|afect.*bien.*fam/i, code: "500-32" },

    // ── Propiedad horizontal ──
    { pattern: /reglam.*p\.?\s*h|afect.*horiz/i, code: "512-30" },

    // ── Sucesiones / herencia (specific before generic) ──
    { pattern: /adj.*disol.*soc.*cony|disol.*soc.*cony/i, code: "709-00" },
    { pattern: /adj.*parti|partic.*herenc/i, code: "716-00" },
    { pattern: /ces.*der.*her.*s.*inm.*oner/i, code: "720-00" },
    { pattern: /ces.*der.*her.*inmueble.*oner/i, code: "720-00" },
    { pattern: /ces.*der.*her.*sobre.*inm/i, code: "720-00" },
    { pattern: /ces.*der.*her/i, code: "700-00" },
    { pattern: /declarator.*hered/i, code: "707-00" },
    { pattern: /renun.*herenc/i, code: "730-00" },
    { pattern: /inscr.*declarator/i, code: "707-00" },

    // ── División condominio ──
    { pattern: /divis.*condom/i, code: "705-00" },

    // ── Sociedades ──
    { pattern: /const.*soc|soc.*const|constitucion\s+sociedad/i, code: "600-20" },
    { pattern: /protocol.*disol|adj.*liq.*soc/i, code: "606-00" },
    { pattern: /fusi[oó]n.*soc/i, code: "605-00" },
    { pattern: /transf.*soc|reform.*estat/i, code: "604-00" },

    // ── Fideicomiso ──
    { pattern: /transf.*fiduc|fideic/i, code: "108-30" },
    { pattern: /transf.*benef/i, code: "121-00" },

    // ── Dación en pago ──
    { pattern: /daci[oó]n.*pago/i, code: "110-00" },

    // ── Permuta ──
    { pattern: /permut/i, code: "107-00" },

    // ── Distracto ──
    { pattern: /distract/i, code: "105-00" },

    // ── Complementaria / Rectificatoria ──
    { pattern: /complement|aclarator|rectificat/i, code: "702-20" },

    // ── Anotación marginal ──
    { pattern: /anot.*marg/i, code: "701-00" },

    // ── Segundo testimonio ──
    { pattern: /segund.*testim|2.*testim/i, code: "708-00" },

    // ── Obra nueva ──
    { pattern: /obra\s*nuev/i, code: "515-00" },

    // ── Servidumbre ──
    { pattern: /servidum/i, code: "404-00" },

    // ── Cancelación general ──
    { pattern: /cancel/i, code: "311-00" },

    // ── Cesión derechos (specific before generic) ──
    { pattern: /ces.*der.*acc/i, code: "902-00" },
    { pattern: /ces.*bol/i, code: "825-00" },
    { pattern: /ces.*cuot/i, code: "604-00" },
    { pattern: /ces.*der/i, code: "834-00" },

    // ── Boleto ──
    { pattern: /bolet.*compra/i, code: "824-02" },

    // ── Locación ──
    { pattern: /locac|contrat.*locac/i, code: "857-02" },

    // ── Automotores ──
    { pattern: /autom.*nuev|formul.*08/i, code: "813-02" },
    { pattern: /autom.*usad/i, code: "814-02" },

    // ── Protocolización ──
    { pattern: /protocol/i, code: "875-30" },

    // ── Reconocimiento de deuda ──
    { pattern: /reconoc.*deud/i, code: "879-30" },

    // ── Testamento ──
    { pattern: /testam/i, code: "800-32" },

    // ── Convenciones matrimoniales ──
    { pattern: /convenc.*matrim|pacto.*conviv/i, code: "801-00" },

    // ── Compensación / bonificación ──
    { pattern: /bonific|compens/i, code: "900-00" },

    // ── Desembolso (crédito hipotecario) ──
    { pattern: /desembols/i, code: "300-00" },

    // ── Actas y poderes → catch-all 800-32 ──
    { pattern: /^acta|acta\b/i, code: "800-32" },
    { pattern: /poder|pod\b|pod\./i, code: "800-32" },

    // ── Renta vitalicia ──
    { pattern: /renta\s*vital/i, code: "410-00" },

    // ── Prenda ──
    { pattern: /prend/i, code: "866-00" },

    // ── Leasing ──
    { pattern: /leasing/i, code: "109-00" },

    // ── Nuda propiedad ──
    { pattern: /nuda\s*prop/i, code: "103-00" },

    // ── Préstamo / mutuo (fallback to hipoteca) ──
    { pattern: /pr[eé]stamo|mutuo/i, code: "300-00" },
];

function getCESBACode(tipoActo: string): string | null {
    if (!tipoActo) return null;
    const normalized = tipoActo.trim();

    // 1. Regex classifier (handles abbreviations, compound acts, specifics)
    for (const rule of CLASSIFIER_RULES) {
        if (rule.pattern.test(normalized)) {
            return rule.code;
        }
    }

    // 2. Fallback: search taxonomy descriptions
    const upper = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const acts = actsData as Record<string, any>;
    for (const [code, act] of Object.entries(acts)) {
        const desc = ((act as any).description || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
        if (desc === upper) return code;
    }
    for (const [code, act] of Object.entries(acts)) {
        const desc = ((act as any).description || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
        if (upper.length > 4 && (desc.includes(upper) || upper.includes(desc))) return code;
    }

    return null;
}

// Servidor Dummy HTTP para Railway Healthcheck
const port = process.env.PORT || 8080;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('EscriAR Worker is running\n');
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
                .in('job_type', ['INGEST', 'NOTE_ANALYSIS', 'CERT_EXTRACT', 'ESCRITURA_EXTRACT'])
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

            // ── ESCRITURA_EXTRACT: extraer datos de escritura del protocolo ──
            if (job.job_type === 'ESCRITURA_EXTRACT') {
                await processEscrituraExtraction(job);
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
                // Strip parenthetical codes like "(007)" that AI sometimes appends
                const cleaned = (p || 'Sin Partido').trim().replace(/\s*\(\d+\)\s*/g, '').trim() || 'Sin Partido';
                const stripped = cleaned.toLowerCase().replace(/[áéíóúü]/g, c => accentMap[c] || c);
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
                    // Resolver códigos jurisdiccionales determinísticamente
                    const jurisdiccion = await resolveJurisdiction(partidoId);

                    const { data: insertedInmueble, error: inmuebleError } = await supabase.from('inmuebles').insert({
                        partido_id: partidoId,
                        nro_partida: nroPartida,
                        nomenclatura: inm.nomenclatura || null,
                        transcripcion_literal: inm.transcripcion_literal || null,
                        titulo_antecedente: inm.titulo_antecedente || null,
                        valuacion_fiscal: inm.valuacion_fiscal || null,
                        ...(jurisdiccion && {
                            partido_code: jurisdiccion.partyCode,
                            delegacion_code: jurisdiccion.delegationCode,
                        }),
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
                    
                    // NUEVO: Fallback por nombre para evitar duplicar "FIDEICOMISO ARES" sin CUIT
                    if (!dniFinal && cliente.nombre_completo) {
                        let searchName = cliente.nombre_completo.replace('S.A.', '').replace('S.R.L.', '').replace('SA', '').replace('SRL', '').replace(',', '').trim();
                        if(searchName.length > 4) {
                            const { data: existingByName } = await supabase.from('personas')
                                .select('dni')
                                .ilike('nombre_completo', `%${searchName}%`)
                                .not('dni', 'like', 'SIN_DNI_%')
                                .not('dni', 'like', 'TEMP-%')
                                .limit(1)
                                .maybeSingle();
                                
                            if (existingByName) dniFinal = existingByName.dni;
                        }
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

// ── ESCRITURA_EXTRACT: Extracción de escrituras del protocolo ──

async function processEscrituraExtraction(job: any) {
    const registroId = job.entity_ref?.registro_id;

    if (!registroId) {
        console.error(`[WORKER] ESCRITURA_EXTRACT job ${job.id}: sin registro_id en entity_ref`);
        await supabase.from('ingestion_jobs').update({
            status: 'failed',
            error_message: 'entity_ref.registro_id faltante',
            finished_at: new Date().toISOString(),
        }).eq('id', job.id);
        return;
    }

    console.log(`[WORKER] ESCRITURA_EXTRACT: Procesando registro ${registroId}`);

    try {
        // 1. Marcar registro como PROCESANDO
        await supabase.from('protocolo_registros').update({
            extraction_status: 'PROCESANDO',
            extraction_error: null,
        }).eq('id', registroId);

        // 2. Descargar archivo del storage
        console.log(`[WORKER] ESCRITURA_EXTRACT: Descargando de protocolo: ${job.file_path}`);

        const { data: fileBlob, error: dlErr } = await supabase.storage
            .from('protocolo')
            .download(job.file_path);

        if (dlErr) throw new Error(`Error descargando archivo: ${dlErr.message}`);
        const fileBuffer = Buffer.from(await fileBlob.arrayBuffer());

        // 3. Determinar si es PDF nativo o escaneado
        let textContent: string | null = null;
        let imageBuffers: Buffer[] | null = null;

        const isPdf = job.file_path?.toLowerCase().endsWith('.pdf') ||
                       job.original_filename?.toLowerCase().endsWith('.pdf');

        if (isPdf) {
            try {
                const parsed = await pdfParse(fileBuffer);
                textContent = parsed.text || '';
            } catch {
                textContent = '';
            }

            if (!textContent || textContent.trim().length < 200) {
                console.log(`[WORKER] ESCRITURA_EXTRACT: PDF escaneado, convirtiendo a imágenes...`);
                textContent = null;
                imageBuffers = await convertPdfToImages(fileBuffer, 10); // Escrituras pueden ser más largas
            }
        } else {
            imageBuffers = [fileBuffer];
        }

        // 4. Extraer con Gemini Pro
        const geminiKey = process.env.GEMINI_API_KEY!;
        const result = await extractEscritura(textContent, imageBuffers, geminiKey);

        console.log(`[WORKER] ESCRITURA_EXTRACT: Extracción exitosa. Campos: ${Object.keys(result.datos).filter(k => (result.datos as any)[k] !== null).join(', ')}`);

        // 4b. Resolver código CESBA: priorizar IA > clasificador regex
        // La IA puede determinar subcódigos precisos (ej 121-51 vivienda única) leyendo el texto,
        // mientras que el clasificador regex solo asigna el código base (ej 121-00).
        const codigoIA = result.datos.codigo_acto;
        const codigoClasificador = getCESBACode(result.datos.tipo_acto || '');
        const validCodeFormat = /^\d{3}-\d{2}(\s*\/\s*\d{3}-\d{2})*$/;

        // Validar código de la IA contra taxonomía
        const codigoIAValido = codigoIA && validCodeFormat.test(codigoIA) && (actsData as Record<string, any>)[codigoIA];

        let codigoResuelto: string | null;
        if (codigoIAValido) {
            // IA determinó un código válido — usarlo (puede tener subcódigo preciso)
            codigoResuelto = codigoIA;
            if (codigoClasificador && codigoClasificador !== codigoIA) {
                console.log(`[WORKER] ESCRITURA_EXTRACT: Usando código IA "${codigoIA}" (clasificador sugirió "${codigoClasificador}", tipo_acto: ${result.datos.tipo_acto})`);
            }
        } else {
            // IA no pudo o dio código inválido — usar clasificador como fallback
            codigoResuelto = codigoClasificador || codigoIA;
            if (codigoIA && codigoIA !== codigoResuelto) {
                console.log(`[WORKER] ESCRITURA_EXTRACT: Código IA "${codigoIA}" inválido, usando clasificador "${codigoResuelto}" (tipo_acto: ${result.datos.tipo_acto})`);
            }
        }
        result.datos.codigo_acto = codigoResuelto;

        // 5. Guardar resultados en protocolo_registros
        const updateData: Record<string, any> = {
            extraction_status: 'COMPLETADO',
            extraction_data: result.datos,
            extraction_evidence: { fragmentos: result.evidencia },
            extraction_error: null,
        };

        // Auto-rellenar campos canónicos.
        // En re-extracción, sobreescribir tipo_acto y campos vacíos.
        // codigo_acto: preservar si ya tiene uno válido (puede ser más preciso que el clasificador).
        const { data: currentReg } = await supabase.from('protocolo_registros')
            .select('tipo_acto, vendedor_acreedor, comprador_deudor, codigo_acto, monto_ars, monto_usd, folios, extraction_data')
            .eq('id', registroId).single();

        const isReExtraction = !!currentReg?.extraction_data;

        // tipo_acto: siempre actualizar con la extracción
        if (result.datos.tipo_acto) {
            updateData.tipo_acto = result.datos.tipo_acto;
        }
        // codigo_acto: preservar el existente si ya tiene un código válido (ej del spreadsheet).
        // Solo asignar automáticamente si no hay código previo.
        const existingCode = currentReg?.codigo_acto;
        if (existingCode && validCodeFormat.test(existingCode)) {
            // Ya tiene código válido — preservarlo, NO sobreescribir
            console.log(`[WORKER] ESCRITURA_EXTRACT: Preservando codigo_acto existente "${existingCode}" (resuelto: "${codigoResuelto}")`);
        } else if (codigoResuelto) {
            // No tiene código o es inválido — usar el resuelto (IA > clasificador)
            updateData.codigo_acto = codigoResuelto;
        }
        // Otros campos: sobreescribir en re-extracción, o llenar si vacíos
        if ((isReExtraction || !currentReg?.vendedor_acreedor) && result.datos.vendedor_acreedor) {
            updateData.vendedor_acreedor = result.datos.vendedor_acreedor;
        }
        if ((isReExtraction || !currentReg?.comprador_deudor) && result.datos.comprador_deudor) {
            updateData.comprador_deudor = result.datos.comprador_deudor;
        }
        if (!currentReg?.monto_ars && result.datos.monto_ars) {
            updateData.monto_ars = result.datos.monto_ars;
        }
        if (!currentReg?.monto_usd && result.datos.monto_usd) {
            updateData.monto_usd = result.datos.monto_usd;
        }
        if (!currentReg?.folios && result.datos.folios) {
            updateData.folios = result.datos.folios;
        }

        await supabase.from('protocolo_registros').update(updateData).eq('id', registroId);

        // Resolve org_id for sugerencias (from user's org membership)
        let orgId: string | null = null;
        if (job.user_id) {
            const { data: orgRow } = await supabase
                .from('organizaciones_users')
                .select('org_id')
                .eq('user_id', job.user_id)
                .limit(1)
                .maybeSingle();
            orgId = orgRow?.org_id || null;
        }

        // 5b. Upsert personas extraídas en tabla `personas` (con dedup inteligente)
        const resolvedPersonas: { dniFinal: string; rol: string; nombre: string }[] = [];
        if (result.datos.personas && result.datos.personas.length > 0) {
            let personasOk = 0;
            let personasDedup = 0;
            for (const persona of result.datos.personas) {
                const rawDni = persona.dni?.replace(/[^a-zA-Z0-9]/g, '') || '';
                const rawCuit = persona.cuit?.replace(/[^a-zA-Z0-9]/g, '') || '';

                // Detect tipo_persona from CUIT prefix
                let tipoPersona = persona.tipo_persona || 'FISICA';
                const cuitPrefix = (rawCuit || rawDni).substring(0, 2);
                if (['30', '33', '34'].includes(cuitPrefix)) tipoPersona = 'JURIDICA';
                const upperName = (persona.nombre_completo || '').toUpperCase();
                if (upperName.includes('BANCO') || upperName.includes('S.A.') || upperName.includes('S.R.L.') || upperName.includes('FIDEICOMISO')) tipoPersona = 'JURIDICA';

                // JURIDICA uses CUIT as ID; FISICA uses DNI
                let dniFinal = '';
                if (tipoPersona === 'JURIDICA' || tipoPersona === 'FIDEICOMISO') {
                    dniFinal = rawCuit || rawDni || '';
                } else {
                    dniFinal = rawDni || rawCuit || '';
                }

                if (!dniFinal) {
                    dniFinal = `SIN_DNI_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                }

                const personaData: Record<string, any> = {
                    dni: dniFinal,
                    nombre_completo: persona.nombre_completo || 'SIN NOMBRE',
                    cuit: rawCuit || null,
                    tipo_persona: tipoPersona,
                    nacionalidad: persona.nacionalidad || null,
                    estado_civil_detalle: persona.estado_civil || null,
                    domicilio_real: persona.domicilio ? { literal: persona.domicilio } : {},
                    origen_dato: 'IA_PROTOCOLO',
                    updated_at: new Date().toISOString(),
                };

                // Check if persona already exists for dedup
                const { data: existingPersona } = await supabase
                    .from('personas').select('*').eq('dni', dniFinal).maybeSingle();

                if (existingPersona) {
                    // Compare key fields — only create sugerencia if there are real differences
                    const diffs: { campo: string; existente: any; extraido: any }[] = [];
                    const compareFields: [string, string][] = [
                        ['nombre_completo', 'nombre_completo'],
                        ['estado_civil_detalle', 'estado_civil_detalle'],
                        ['nacionalidad', 'nacionalidad'],
                    ];
                    for (const [dbField, newField] of compareFields) {
                        const oldVal = (existingPersona as any)[dbField] || '';
                        const newVal = (personaData as any)[newField] || '';
                        if (newVal && oldVal && newVal.toUpperCase() !== oldVal.toUpperCase()) {
                            diffs.push({ campo: dbField, existente: oldVal, extraido: newVal });
                        }
                    }
                    // Compare domicilio
                    const oldDom = existingPersona.domicilio_real?.literal || '';
                    const newDom = personaData.domicilio_real?.literal || '';
                    if (newDom && oldDom && newDom.toUpperCase() !== oldDom.toUpperCase()) {
                        diffs.push({ campo: 'domicilio_real', existente: oldDom, extraido: newDom });
                    }

                    if (diffs.length > 0 && orgId) {
                        // Create sugerencia instead of overwriting
                        await supabase.from('sugerencias').insert({
                            org_id: orgId,
                            carpeta_id: null,
                            protocolo_registro_id: registroId,
                            tipo: 'DEDUP_PERSONA',
                            estado: 'PROPOSED',
                            confianza: 'MED',
                            payload: {
                                descripcion: `Datos diferentes para ${existingPersona.nombre_completo} (${dniFinal})`,
                                persona_dni: dniFinal,
                                diffs,
                            },
                            evidencia_texto: `Extraído del PDF: ${job.original_filename}`,
                        });
                        personasDedup++;
                        console.log(`[WORKER] ⚠️ Dedup sugerencia para persona ${dniFinal}: ${diffs.length} diferencias`);
                    }
                    // Don't overwrite — keep existing data. Still track for participante linking.
                    resolvedPersonas.push({ dniFinal, rol: persona.rol || 'PARTICIPANTE', nombre: persona.nombre_completo || '' });
                    personasOk++;
                    continue;
                }

                // New persona — insert normally
                const { error: personaError } = await supabase.from('personas').upsert(
                    personaData,
                    { onConflict: 'dni' }
                );

                if (personaError) {
                    console.error(`[WORKER] Error upserting persona ${persona.nombre_completo}:`, personaError.message);
                } else {
                    personasOk++;
                }
                resolvedPersonas.push({ dniFinal, rol: persona.rol || 'PARTICIPANTE', nombre: persona.nombre_completo || '' });
            }
            console.log(`[WORKER] ESCRITURA_EXTRACT: ${personasOk}/${result.datos.personas.length} personas procesadas (${personasDedup} sugerencias dedup)`);
        }

        // 5c. Upsert inmuebles extraídos en tabla `inmuebles` (con dedup inteligente)
        let firstInmuebleId: string | null = null;
        if (result.datos.inmuebles && result.datos.inmuebles.length > 0) {
            const normPartido = (p: string) => {
                const accentMap: Record<string, string> = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u' };
                // Strip parenthetical codes like "(007)" that AI sometimes appends
                const cleaned = (p || 'Sin Partido').trim().replace(/\s*\(\d+\)\s*/g, '').trim() || 'Sin Partido';
                const stripped = cleaned.toLowerCase().replace(/[áéíóúü]/g, c => accentMap[c] || c);
                return stripped.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            };
            const normPartida = (p: string) => (p || '000000').trim().replace(/\./g, '');

            let inmueblesOk = 0;
            let inmueblesDedup = 0;
            for (const inm of result.datos.inmuebles) {
                const partidoId = normPartido(inm.partido || 'Sin Partido');
                // Handle comma-separated partidas (e.g. "12345, 67890")
                const partidasRaw = (inm.partida_inmobiliaria || '000000');
                const partidas = partidasRaw.includes(',')
                    ? partidasRaw.split(',').map((p: string) => normPartida(p.trim()))
                    : [normPartida(partidasRaw)];

                for (const nroPartida of partidas) {
                    // Check if already exists
                    if (nroPartida && nroPartida !== '000000') {
                        const { data: existing } = await supabase.from('inmuebles')
                            .select('id, nomenclatura, transcripcion_literal')
                            .eq('partido_id', partidoId)
                            .eq('nro_partida', nroPartida)
                            .maybeSingle();
                        if (existing) {
                            if (!firstInmuebleId) firstInmuebleId = existing.id;

                            // Check for differences to create sugerencia
                            const diffs: { campo: string; existente: any; extraido: any }[] = [];
                            const newNom = inm.nomenclatura || '';
                            const newDesc = inm.descripcion || '';
                            if (newNom && existing.nomenclatura && newNom !== existing.nomenclatura) {
                                diffs.push({ campo: 'nomenclatura', existente: existing.nomenclatura, extraido: newNom });
                            }
                            if (newDesc && existing.transcripcion_literal && newDesc !== existing.transcripcion_literal) {
                                diffs.push({ campo: 'transcripcion_literal', existente: existing.transcripcion_literal?.substring(0, 200), extraido: newDesc.substring(0, 200) });
                            }
                            if (diffs.length > 0 && orgId) {
                                await supabase.from('sugerencias').insert({
                                    org_id: orgId,
                                    carpeta_id: null,
                                    protocolo_registro_id: registroId,
                                    tipo: 'DEDUP_INMUEBLE',
                                    estado: 'PROPOSED',
                                    confianza: 'MED',
                                    payload: {
                                        descripcion: `Datos diferentes para inmueble ${partidoId}/${nroPartida}`,
                                        inmueble_id: existing.id,
                                        diffs,
                                    },
                                    evidencia_texto: `Extraído del PDF: ${job.original_filename}`,
                                });
                                inmueblesDedup++;
                                console.log(`[WORKER] ⚠️ Dedup sugerencia para inmueble ${partidoId}/${nroPartida}`);
                            }

                            console.log(`[WORKER] ♻️ Inmueble ${partidoId}/${nroPartida} ya existe (${existing.id})`);
                            inmueblesOk++;
                            continue;
                        }
                    }

                    // Resolver códigos jurisdiccionales
                    const jurisdiccion2 = await resolveJurisdiction(partidoId);

                    const { data: inserted, error: inmError } = await supabase.from('inmuebles').insert({
                        partido_id: partidoId,
                        nro_partida: nroPartida,
                        nomenclatura: inm.nomenclatura || null,
                        transcripcion_literal: inm.descripcion || null,
                        ...(jurisdiccion2 && {
                            partido_code: jurisdiccion2.partyCode,
                            delegacion_code: jurisdiccion2.delegationCode,
                        }),
                    }).select('id').single();

                    if (inmError) {
                        console.warn(`[WORKER] Warning insertando inmueble ${partidoId}/${nroPartida}:`, inmError.message);
                    } else {
                        if (!firstInmuebleId && inserted) firstInmuebleId = inserted.id;
                        inmueblesOk++;
                    }
                }
            }
            console.log(`[WORKER] ESCRITURA_EXTRACT: ${inmueblesOk} inmuebles procesados (${inmueblesDedup} sugerencias dedup)`);
        }

        // 5d. Crear escritura + operación + participantes para trazabilidad completa
        let escrituraId: string | null = null;
        {
            // Generate public URL for the PDF
            const { data: urlData } = supabase.storage.from('protocolo').getPublicUrl(job.file_path);
            const pdfUrl = urlData?.publicUrl || null;

            // Parse fecha from extraction data
            let fechaEscritura: string | null = null;
            if (result.datos.fecha) {
                fechaEscritura = result.datos.fecha; // Already YYYY-MM-DD from extractor
            }

            // Check if escritura already exists for this protocolo_registro
            const { data: existingEsc } = await supabase.from('escrituras')
                .select('id')
                .eq('protocolo_registro_id', registroId)
                .maybeSingle();

            if (existingEsc) {
                escrituraId = existingEsc.id;
                console.log(`[WORKER] ♻️ Escritura ya existe para registro ${registroId}: ${escrituraId}`);
            } else {
                // Create new escritura (NO carpeta)
                const { data: newEsc, error: escError } = await supabase.from('escrituras').insert({
                    source: 'PROTOCOLO',
                    carpeta_id: null,
                    nro_protocolo: result.datos.nro_escritura || null,
                    fecha_escritura: fechaEscritura,
                    pdf_url: pdfUrl,
                    inmueble_princ_id: firstInmuebleId,
                    protocolo_registro_id: registroId,
                    notario_interviniente: null, // Not in EscrituraExtractionSchema
                    registro: null,
                }).select('id').single();

                if (escError) {
                    console.error(`[WORKER] Error creando escritura para registro ${registroId}:`, escError.message);
                } else {
                    escrituraId = newEsc.id;
                    console.log(`[WORKER] ✅ Escritura creada: ${escrituraId} (N° ${result.datos.nro_escritura || '?'})`);
                }
            }

            // Create operacion + participantes if we have an escritura
            if (escrituraId) {
                // Upsert operacion
                const { data: existingOps } = await supabase.from('operaciones')
                    .select('id').eq('escritura_id', escrituraId).limit(1);

                let operacionId: string | null = null;
                if (existingOps && existingOps.length > 0) {
                    operacionId = existingOps[0].id;
                    await supabase.from('operaciones').update({
                        tipo_acto: result.datos.tipo_acto || null,
                        codigo: codigoResuelto || null,
                        monto_operacion: result.datos.monto_ars || null,
                    }).eq('id', operacionId);
                } else {
                    const { data: newOp, error: opError } = await supabase.from('operaciones').insert({
                        escritura_id: escrituraId,
                        tipo_acto: result.datos.tipo_acto || null,
                        codigo: codigoResuelto || null,
                        monto_operacion: result.datos.monto_ars || null,
                    }).select('id').single();

                    if (opError) {
                        console.error(`[WORKER] Error creando operación:`, opError.message);
                    } else {
                        operacionId = newOp.id;
                    }
                }

                // Link participantes
                if (operacionId && resolvedPersonas.length > 0) {
                    let partOk = 0;
                    for (const rp of resolvedPersonas) {
                        const { error: partError } = await supabase.from('participantes_operacion').upsert({
                            operacion_id: operacionId,
                            persona_id: rp.dniFinal,
                            rol: rp.rol,
                        }, { onConflict: 'operacion_id,persona_id', ignoreDuplicates: true });

                        if (partError) {
                            console.warn(`[WORKER] Warning linking participante ${rp.dniFinal}:`, partError.message);
                        } else {
                            partOk++;
                        }
                    }
                    console.log(`[WORKER] ✅ ${partOk} participantes vinculados a operación ${operacionId}`);
                }

                // Update protocolo_registros with escritura_id back-reference
                await supabase.from('protocolo_registros').update({
                    escritura_id: escrituraId,
                }).eq('id', registroId);
            }
        }

        // 6. Marcar job como completed
        await supabase.from('ingestion_jobs').update({
            status: 'completed',
            result_data: {
                campos_extraidos: Object.keys(result.datos).filter(k => (result.datos as any)[k] !== null).length,
                personas_upserted: result.datos.personas?.length || 0,
                inmuebles_upserted: result.datos.inmuebles?.length || 0,
                escritura_id: escrituraId,
            },
            finished_at: new Date().toISOString(),
        }).eq('id', job.id);

        console.log(`[WORKER] ESCRITURA_EXTRACT job ${job.id} COMPLETADO`);

    } catch (error: any) {
        console.error(`[WORKER] ESCRITURA_EXTRACT job ${job.id} FAILED:`, error.message);

        await supabase.from('protocolo_registros').update({
            extraction_status: 'ERROR',
            extraction_error: error.message?.substring(0, 500) || 'Error desconocido',
        }).eq('id', registroId);

        await supabase.from('ingestion_jobs').update({
            status: 'failed',
            error_message: error.message || 'Error desconocido',
            finished_at: new Date().toISOString(),
        }).eq('id', job.id);
    }
}

// Iniciar
workerLoop();
