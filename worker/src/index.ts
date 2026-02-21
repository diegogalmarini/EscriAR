import { createClient } from '@supabase/supabase-js';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { fromBuffer } from 'pdf2pic';
import * as dotenv from 'dotenv';
import { z } from 'zod';
import * as http from 'http';
import actsData from './acts_taxonomy_2026.json';
const pdfParse = require('pdf-parse');

dotenv.config();

// --- CESBA Code Assignment ---
// Direct code mappings for acts that don't follow baseCode-subcode pattern
const DIRECT_CODE_MAP: Record<string, string> = {
    'REGLAMENTO DE PROPIEDAD HORIZONTAL': '512-30',
    'REGLAMENTO DE PH': '512-30',
    'AFECTACION A PROPIEDAD HORIZONTAL': '512-30',
    'DIVISION DE CONDOMINIO': '512-30',
    'MODIFICACION DE REGLAMENTO': '513-30',
};

const OPERATION_BASE_CODES: Record<string, string> = {
    "COMPRAVENTA": "100",
    "HIPOTECA": "300",
    "CANCELACION_HIPOTECA": "311",
    "DONACION": "200",
    "CESION": "400",
    "PODER": "500",
    "ACTA": "600",
    "AFECTACION_BIEN_FAMILIA": "800",
    "USUFRUCTO": "150",
    "FIDEICOMISO": "121",
};

const OPERATION_MAP: Record<string, string> = {
    'VENTA': 'COMPRAVENTA',
    'COMPRAVENTA': 'COMPRAVENTA',
    'COMPRA': 'COMPRAVENTA',
    'PRESTAMO': 'HIPOTECA',
    'PRESTAMO BANCARIO': 'HIPOTECA',
    'PRESTAMO HIPOTECARIO': 'HIPOTECA',
    'HIPOTECA': 'HIPOTECA',
    'MUTUO HIPOTECARIO': 'HIPOTECA',
    'MUTUO': 'HIPOTECA',
    'CONTRATO DE CREDITO': 'HIPOTECA',
    'CREDITO HIPOTECARIO': 'HIPOTECA',
    'CANCELACION': 'CANCELACION_HIPOTECA',
    'CANCELACION DE HIPOTECA': 'CANCELACION_HIPOTECA',
    'LEVANTAMIENTO DE HIPOTECA': 'CANCELACION_HIPOTECA',
    'DONACION': 'DONACION',
    'CESION': 'CESION',
    'CESION DE DERECHOS': 'CESION',
    'PODER': 'PODER',
    'PODER GENERAL': 'PODER',
    'PODER ESPECIAL': 'PODER',
    'ACTA': 'ACTA',
    'USUFRUCTO': 'USUFRUCTO',
    'FIDEICOMISO': 'FIDEICOMISO',
    'AFECTACION BIEN DE FAMILIA': 'AFECTACION_BIEN_FAMILIA',
    'SOCIEDAD': 'CONSTITUCION_SOCIEDAD',
    'TRANSFERENCIA DE DOMINIO A BENEFICIARIO': 'FIDEICOMISO',
    'ADJUDICACION DE FIDEICOMISO': 'FIDEICOMISO',
};

function getCESBACode(tipoActo: string): string | null {
    const normalized = (tipoActo || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    const acts = actsData as Record<string, any>;

    // 1. Try direct code map (exact match first)
    if (DIRECT_CODE_MAP[normalized]) return DIRECT_CODE_MAP[normalized];

    // 2. Try direct code map (partial match)
    for (const [key, code] of Object.entries(DIRECT_CODE_MAP)) {
        if (normalized.includes(key)) return code;
    }

    // 3. Try operation map (exact match)
    let opType = OPERATION_MAP[normalized];

    // 4. Try operation map (partial match)
    if (!opType) {
        for (const [key, value] of Object.entries(OPERATION_MAP)) {
            if (normalized.includes(key)) {
                opType = value;
                break;
            }
        }
    }

    if (!opType) return null;

    const baseCode = OPERATION_BASE_CODES[opType];
    if (!baseCode) return null;

    const fullCode = `${baseCode}-00`;

    // Verify code exists in taxonomy
    if (acts[fullCode]) return fullCode;

    // Try base code with other common subcodes
    for (const sub of ['-00', '-30', '-51']) {
        if (acts[`${baseCode}${sub}`]) return `${baseCode}${sub}`;
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
3. BANCOS Y ENTIDADES: Si dice "en representación de BANCO X", extrae DOS entidades: el banco (JURIDICA, rol ACREEDOR) y el representante (FISICA, rol APODERADO).
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
                    prompt: EXTRACTION_PROMPT + textContent.substring(0, 150000),
                    schema: NotarySchema
                });

            } else {
                console.log(`[WORKER] PDF Escaneado detectado. Iniciando VISION OCR.`);
                processingMethod = 'vision-ocr';

                const imageBuffers = await convertPdfToImages(fileBuffer, 6); // Primeras 6 pág.
                console.log(`[WORKER] Vision: Extraídas ${imageBuffers.length} imágenes.`);

                const contentParts: any[] = [
                    { type: 'text', text: VISION_PROMPT }
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

            // A. Insertar Inmueble (DEDUP: check by partido_id + nro_partida)
            // Normalize helpers (inline since worker is a separate project)
            const normPartido = (p: string) => (p || 'Sin Partido').trim().toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
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
                for (const cliente of extractedData.clientes) {
                    const rawDni = cliente.dni?.replace(/[^a-zA-Z0-9]/g, '') || '';
                    const rawCuit = cliente.cuit?.replace(/[^a-zA-Z0-9]/g, '') || '';
                    const dniFinal = rawDni || rawCuit || `SIN_DNI_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

                    const personaData: any = {
                        dni: dniFinal,
                        nombre_completo: cliente.nombre_completo || 'SIN NOMBRE',
                        cuit: rawCuit || null,
                        tipo_persona: cliente.tipo_persona || 'FISICA',
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
