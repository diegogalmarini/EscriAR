// --- SERVER-SIDE BROWSER POLYFILLS (SAFE) ---
if (typeof globalThis !== 'undefined') {
    const g = globalThis as any;
    if (!g.window) g.window = g;
    if (!g.self) g.self = g;

    // Polyfill character encoding
    if (!g.atob) g.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
    if (!g.btoa) g.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');

    // Ensure navigator exists minimally
    if (!g.navigator) g.navigator = { userAgent: 'Node.js/NotiAR' };
}
// Flash v1.2.17 - SCHEMA FIX: Separated DNI/CUIT + Biographical Fields
import { NextResponse, after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeID, toTitleCase, formatCUIT, normalizePartido, normalizePartida, splitMultiplePartidas } from '@/lib/utils/normalization';
import { SkillExecutor } from '@/lib/agent/SkillExecutor';
import { classifyDocument } from '@/lib/skills/routing/documentClassifier';
import { taxonomyService, ActIntent } from '@/lib/services/TaxonomyService';

// Helper to get CESBA code from tipo_acto
// Direct code mappings for acts that don't follow baseCode-subcode pattern
const DIRECT_CODE_MAP: Record<string, string> = {
    'REGLAMENTO DE PROPIEDAD HORIZONTAL': '512-30',
    'REGLAMENTO DE PH': '512-30',
    'AFECTACION A PROPIEDAD HORIZONTAL': '512-30',
    'DIVISION DE CONDOMINIO': '512-30',
    'MODIFICACION DE REGLAMENTO': '513-30',
};

function getCESBACode(tipoActo: string, isFamilyHome: boolean = false): string | null {
    const normalized = (tipoActo || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

    // 1. Try direct code map (exact match)
    if (DIRECT_CODE_MAP[normalized]) return DIRECT_CODE_MAP[normalized];

    // 2. Try direct code map (partial match)
    for (const [key, code] of Object.entries(DIRECT_CODE_MAP)) {
        if (normalized.includes(key)) return code;
    }

    // 3. Map common act types to operation types
    const operationMap: Record<string, ActIntent['operation_type']> = {
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

    const operationType = operationMap[normalized] || 'OTRO';

    if (operationType === 'OTRO') {
        // Try partial match
        for (const [key, value] of Object.entries(operationMap)) {
            if (normalized.includes(key)) {
                const act = taxonomyService.findActByIntent({ operation_type: value, is_family_home: isFamilyHome });
                return act?.code || null;
            }
        }
        return null;
    }

    const act = taxonomyService.findActByIntent({ operation_type: operationType, is_family_home: isFamilyHome });
    return act?.code || null;
}

export const maxDuration = 300;

// --- HELPERS ---

// Helper for loose name matching (ignoring order and commas)
function looseNameMatch(n1: string, n2: string): boolean {
    if (!n1 || !n2) return false;
    const clean = (s: string) => s.toUpperCase().replace(/\W/g, " ").trim();
    const s1 = clean(n1);
    const s2 = clean(n2);

    if (s1 === s2) return true;

    // Fiduciary Token Matching (Special for G-4, etc)
    const getFidToken = (s: string) => s.split(/\s+/).find(t => /\d/.test(t) && t.length <= 5);
    const f1 = getFidToken(s1);
    const f2 = getFidToken(s2);

    // CRITICAL: If both names are about trusts, match ONLY if fiduciary token matches
    const isTrust1 = s1.includes("FIDEICOMISO");
    const isTrust2 = s2.includes("FIDEICOMISO");
    if (isTrust1 && isTrust2) {
        if (f1 && f2) return f1 === f2;
        return s1.includes(s2) || s2.includes(s1);
    }

    // If one is trust and other is not, they MUST not match unless it's a very clear containment
    if (isTrust1 !== isTrust2) {
        // Exception: "FIDEICOMISO G-4" vs "G-4" might be the same entity
        if (f1 && f2 && f1 === f2) return true;
        return false;
    }

    const stopWords = ["SOCIEDAD", "ANONIMA", "ADMINISTRADO", "POR", "FIDUCIARIA", "DE", "LA", "EL", "LOS", "LAS", "SA", "SRL"];
    const getTokens = (s: string) => s
        .split(/\s+/)
        .filter(t => (t.length > 2 || /\d/.test(t)) && !stopWords.includes(t));

    const t1 = getTokens(s1);
    const t2 = getTokens(s2);

    if (t1.length === 0 || t2.length === 0) return s1.includes(s2) || s2.includes(s1);

    const set2 = new Set(t2);
    const intersection = t1.filter((t: any) => set2.has(t));
    const matchCount = intersection.length;
    const minTokens = Math.min(t1.length, t2.length);

    return matchCount >= minTokens || (matchCount >= 2);
}

function extractString(val: any, joinWithComma: boolean = true): string | null {
    if (val === null || val === undefined) return null;
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed.toLowerCase() === 'null') return null;
        return trimmed;
    }
    if (typeof val === 'number') return String(val);
    if (val.valor) {
        const v = String(val.valor).trim();
        if (v.toLowerCase() === 'null') return null;
        return v;
    }
    if (val.razon_social) return extractString(val.razon_social);
    if (val.nombre) return extractString(val.nombre);
    if (val.apellidos || val.nombres) {
        const a = extractString(val.apellidos) || "";
        const n = extractString(val.nombres) || "";
        if (a && n) return joinWithComma ? `${a}, ${n}` : `${n} ${a}`.trim();
        return (a || n || null);
    }
    return null;
}

function safeParseInt(val: any): number | null {
    if (val === null || val === undefined) return null;
    const str = String(val).trim().toUpperCase();
    const p = parseInt(str);
    if (!isNaN(p)) return p;

    // Spanish text to number mapping (basic units and tens)
    const textNumbers: Record<string, number> = {
        "UNO": 1, "DOS": 2, "TRES": 3, "CUATRO": 4, "CINCO": 5, "SEIS": 6, "SIETE": 7, "OCHO": 8, "NUEVE": 9, "DIEZ": 10,
        "ONCE": 11, "DOCE": 12, "TRECE": 13, "CATORCE": 14, "QUINCE": 15, "DIECISEIS": 16, "DIECISIETE": 17, "DIECIOCHO": 18, "DIECINUEVE": 19, "VEINTE": 20,
        "VEINTIUNO": 21, "VEINTIDOS": 22, "VEINTITRES": 23, "VEINTICUATRO": 24, "VEINTICINCO": 25, "VEINTISEIS": 26, "VEINTISIETE": 27, "VEINTIOCHO": 28, "VEINTINUEVE": 29, "TREINTA": 30,
        "CUARENTA": 40, "CINCUENTA": 50, "SESENTA": 60, "SETENTA": 70, "OCHENTA": 80, "NOVENTA": 90, "CIEN": 100,
        // HUNDREDS - Added to fix "SETECIENTOS SETENTA Y UNO" → 771
        "CIENTO": 100, "DOSCIENTOS": 200, "TRESCIENTOS": 300, "CUATROCIENTOS": 400, "QUINIENTOS": 500,
        "SEISCIENTOS": 600, "SETECIENTOS": 700, "OCHOCIENTOS": 800, "NOVECIENTOS": 900,
        // MIL for thousands
        "MIL": 1000
    };

    if (textNumbers[str]) return textNumbers[str];

    // Compound handling: "SETECIENTOS SETENTA Y UNO" → 700 + 70 + 1 = 771
    const parts = str.split(/[\s-]+/).filter((p: any) => p && p !== 'Y');
    if (parts.length > 1) {
        let total = 0;
        for (const part of parts) {
            if (textNumbers[part]) total += textNumbers[part];
        }
        return total > 0 ? total : null;
    }

    return null;
}

function safeParseDate(val: any): string | null {
    if (!val) return null;
    try {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d.toISOString();
    } catch (e) {
        return null;
    }
}

/**
 * Main POST handler for document ingestion.
 */
export async function POST(req: Request) {
    try {
        console.log("🚀 STARTING INGESTION PIPELINE...");

        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: "No se encontró el archivo en la solicitud." }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // 1. Initial creation for status tracking
        console.log(`[PIPELINE] Creating folder for: ${file.name}`);
        const { data: carpeta, error: folderError } = await supabaseAdmin.from('carpetas').insert({
            caratula: file.name.substring(0, 100),
            ingesta_estado: 'PROCESANDO',
            ingesta_paso: 'Iniciando análisis'
        }).select().single();

        if (folderError) throw new Error(`Error creando carpeta: ${folderError.message}`);

        // --- HYBRID PROCESSING: SYNC for Small, ASYNC for Large ---
        const isLarge = file.size > 500 * 1024; // 500KB threshold

        if (isLarge) {
            console.log(`[PIPELINE] 📦 LARGE FILE detected (${file.size} bytes). Routing to BACKGROUND.`);

            // Return immediate response to the client
            after(async () => {
                try {
                    console.log(`[BACKGROUND] Starting extraction for: ${file.name}`);
                    const extractedText = "[OCR Placeholder for Audit Path]"; // TODO: Implement real OCR if needed
                    const classification = await classifyDocument(file, extractedText);
                    const docType = classification?.document_type || 'ESCRITURA';

                    const aiData = await runExtractionPipeline(docType, file, extractedText);
                    const result = await persistIngestedData(aiData, file, buffer, carpeta.id);

                    await supabaseAdmin.from('carpetas').update({
                        ingesta_estado: result.success ? 'COMPLETADO' : 'ERROR',
                        ingesta_paso: result.success
                            ? `IA: ${result.persistedClients || 0} personas, ${aiData.inmuebles?.length || 0} inmuebles`
                            : `Error: ${result.error || 'Ver logs'}`,
                        resumen_ia: result.success ? `${aiData.resumen_acto || 'Extracción Background'}` : null
                    }).eq('id', carpeta.id);

                    revalidatePath('/carpetas');
                    revalidatePath('/dashboard');
                } catch (bgError: any) {
                    console.error("🔥 BACKGROUND PIPELINE FATAL:", bgError);
                    await supabaseAdmin.from('carpetas').update({
                        ingesta_estado: 'ERROR',
                        ingesta_paso: `Fatal: ${bgError.message}`
                    }).eq('id', carpeta.id);
                }
            });

            return NextResponse.json({
                success: true,
                status: 'PROCESSING_BACKGROUND',
                folderId: carpeta.id,
                message: "Archivo grande detectado. Procesando en segundo plano."
            });
        }

        // --- FLASH SYNC PROCESSING (Small files) ---
        console.log(`[PIPELINE] ⚡ FLASH SYNC PROCESSING: ${file.name} (${file.size} bytes)`);

        let extractedText = "[OCR Placeholder for Audit Path]";
        const classification = await classifyDocument(file, extractedText);
        const docType = classification?.document_type || 'ESCRITURA';

        const aiData = await runExtractionPipeline(docType, file, extractedText);
        const result = await persistIngestedData(aiData, file, buffer, carpeta.id);

        await supabaseAdmin.from('carpetas').update({
            ingesta_estado: result.success ? 'COMPLETADO' : 'ERROR',
            ingesta_paso: result.success
                ? `IA: ${result.persistedClients || 0} personas, ${aiData.inmuebles?.length || 0} inmuebles`
                : `Error: ${result.error || 'Ver logs'}`,
            resumen_ia: result.success ? `${aiData.resumen_acto || 'Extracción Flash'}` : null
        }).eq('id', carpeta.id);

        revalidatePath('/carpetas');
        revalidatePath('/dashboard');

        return NextResponse.json({
            success: result.success,
            status: result.success ? 'COMPLETED' : 'PARTIAL_ERROR',
            folderId: result.folderId,
            extractedData: aiData,
            debug: {
                clients: aiData.clientes?.length || 0,
                persistedClients: result.persistedClients || 0,
                assets: aiData.inmuebles?.length || 0
            }
        });

        // ✅ Invalidate cache so new folder appears immediately
        revalidatePath('/dashboard');
        revalidatePath('/carpetas');

    } catch (error: any) {
        console.error("🔥 FULL INGESTION ERROR:", error);
        return NextResponse.json({
            error: 'Error interno en la ingesta. Reintente o contacte soporte.'
        }, { status: 500 });
    }
}

async function runExtractionPipeline(docType: string, file: File, extractedText: string) {
    let aiData: any = null;
    switch (docType) {
        case 'DNI':
        case 'PASAPORTE':
            aiData = await SkillExecutor.execute('notary-identity-vision', file, { extractedText });
            break;
        case 'ESCRITURA':
        case 'BOLETO_COMPRAVENTA':
        case 'HIPOTECA':
        case 'PRESTAMO':
            const entities = await SkillExecutor.execute('notary-entity-extractor', file, {
                text: extractedText,
                extract_fideicomisos: true,
                extract_cesiones: true
            });
            const normEntities = normalizeAIData(entities);

            // Special handling for Mortgages
            let mortgageDetails = null;
            if (docType === 'HIPOTECA' || docType === 'PRESTAMO') {
                mortgageDetails = await SkillExecutor.execute('notary-mortgage-reader', file, { extractedText });
            }

            // Financial calculations (optional for some documents but part of the standard flow)
            try {
                const isUva = mortgageDetails?.financial_terms?.capital?.currency === 'UVA';
                const uvaRate = mortgageDetails?.financial_terms?.uva_quoted?.valor || 1;

                // Priority: Use ARS equivalent if available for correct tax calculation
                const calcPrice = normEntities.operation_details?.equivalente_ars_cesion ||
                    (isUva ? mortgageDetails?.financial_terms?.capital?.valor : (normEntities.operation_details?.price || 0));
                const calcCurrency = normEntities.operation_details?.equivalente_ars_cesion ? 'ARS' :
                    (isUva ? 'UVA' : (normEntities.operation_details?.currency || 'USD'));

                const taxes = await SkillExecutor.execute('notary-tax-calculator', undefined, {
                    price: calcPrice,
                    currency: calcCurrency,
                    exchangeRate: isUva ? uvaRate : 1
                });

                const compliance = await SkillExecutor.execute('notary-uif-compliance', undefined, {
                    price: normEntities.operation_details?.price || 0,
                    moneda: normEntities.operation_details?.currency || 'USD',
                    parties: normEntities.clientes || []
                });
                aiData = { ...normEntities, mortgage: mortgageDetails, tax_calculation: taxes, compliance };
            } catch (e) {
                console.warn("[PIPELINE] Secondary tools failed (Taxes/UIF/Mortgage):", e);
                aiData = { ...normEntities, mortgage: mortgageDetails };
            }
            break;
        default:
            const raw = await SkillExecutor.execute('notary-entity-extractor', file, { text: extractedText });
            aiData = normalizeAIData(raw);
    }
    return aiData;
}


function normalizeAIData(raw: any) {
    if (!raw) return {};
    const ops = raw.detalles_operacion || {};
    const normalized: any = {
        clientes: [],
        inmuebles: (raw.inmuebles && raw.inmuebles.length > 0) ? raw.inmuebles : (
            (ops.partida_inmobiliaria?.valor || ops.partido_inmobiliario?.valor) ? [{
                partido: ops.partido_inmobiliario || { valor: "San Cayetano", evidencia: "Inferido por IA" }, // Fallback if missing, though schema requests it
                partida_inmobiliaria: ops.partida_inmobiliaria,
                nomenclatura: { valor: "Ver transcripción", evidencia: "Inferido" },
                transcripcion_literal: { valor: "Inmueble objeto de cancelación", evidencia: "Inferido" },
                valuacion_fiscal: { valor: 0, evidencia: "No aplica" }
            }] : []
        ),
        resumen_acto: ops.tipo_acto?.valor || raw.resumen_acto?.valor || 'Ingesta',
        numero_escritura: ops.numero_escritura?.valor || raw.numero_escritura?.valor || null,
        fecha_escritura: ops.fecha_escritura?.valor || raw.fecha_escritura?.valor || null,
        notario: ops.escribano_nombre?.valor || null,
        registro: ops.registro_numero?.valor || null,
        operation_details: {
            price: ops.precio_cesion?.equivalente_ars || ops.precio_cesion?.monto || raw.cesion_beneficiario?.precio_cesion?.monto || ops.precio?.valor || raw.price?.valor || raw.financial_terms?.capital?.valor || 0,
            currency: (ops.precio_cesion?.equivalente_ars ? 'ARS' : (ops.precio_cesion?.moneda || raw.cesion_beneficiario?.precio_cesion?.moneda || ops.precio?.moneda || raw.currency?.valor || raw.financial_terms?.capital?.currency || 'USD')),
            date: ops.fecha_escritura?.valor || raw.fecha_escritura?.valor,
            // Dual pricing for fiduciary operations
            precio_construccion: ops.precio_construccion?.monto || raw.precio_construccion?.monto || null,
            precio_cesion: ops.precio_cesion?.monto || raw.cesion_beneficiario?.precio_cesion?.monto || null,
            tipo_cambio_cesion: ops.precio_cesion?.tipo_cambio || raw.cesion_beneficiario?.precio_cesion?.tipo_cambio || null,
            equivalente_ars_cesion: ops.precio_cesion?.equivalente_ars || raw.cesion_beneficiario?.precio_cesion?.equivalente_ars || null,
            is_family_home: ops.es_vivienda_unica?.valor || false,
            // Mortgage specific (113.pdf)
            capital_original: raw.financial_terms?.capital?.valor || null,
            uva_monto: raw.financial_terms?.uva_quoted?.valor || null,
            tasa_interes: raw.financial_terms?.rate?.valor || null,
            sistema_amortizacion: raw.financial_terms?.system?.valor || null,
            grado_hipoteca: raw.legal_status?.grado || null
        },
        // Beneficiary assignment (fiduciary operations)
        cesion_beneficiario: (raw.cesion_beneficiario || raw.cesion || raw.transferencia) ? (() => {
            const src = raw.cesion_beneficiario || raw.cesion || raw.transferencia;
            return {
                fideicomiso_nombre: src.fideicomiso_nombre || src.fideicomiso?.nombre || null,
                cedente_nombre: (typeof src.cedente === 'string' ? src.cedente : src.cedente?.nombre) || null,
                cedente_fecha_incorporacion: src.cedente?.fecha_incorporacion || null,
                cesionario_nombre: (typeof src.cesionario === 'string' ? src.cesionario : src.cesionario?.nombre) || null,
                cesionario_dni: (typeof src.cesionario === 'object' ? (src.cesionario?.dni || src.cesionario?.id) : null) || src.cesionario_dni || null,
                precio_cesion: (src.precio_cesion?.monto || src.precio?.monto || src.precio || null),
                moneda_cesion: (src.precio_cesion?.moneda || src.moneda || src.precio?.moneda || null),
                fecha_cesion: src.fecha_cesion || src.fecha || null
            };
        })() : null
    };

    // Helper to resolve an entity name from the raw AI object (string or object)
    const resolveName = (src: any): string | null => {
        if (!src) return null;
        if (typeof src === 'string') return src.trim();
        // Use extractString which is already recursive and handles .valor, .nombre, etc.
        return extractString(src);
    };

    const cedenteName = raw.cesion_beneficiario ? resolveName(raw.cesion_beneficiario.cedente) || extractString(raw.cesion_beneficiario.cedente_nombre) : null;
    const cesionarioName = raw.cesion_beneficiario ? resolveName(raw.cesion_beneficiario.cesionario) || extractString(raw.cesion_beneficiario.cesionario_nombre) : null;

    let allClients: any[] = [];

    // Helper to add or merge client to prevent duplicates and role loss
    const addOrMergeClient = (newCl: any) => {
        const existingIdx = allClients.findIndex((cl: any) => {
            const nameMatch = looseNameMatch(cl.nombre_completo, newCl.nombre_completo);
            if (!nameMatch) return false;
            // DNI/CUIT Conflict check (normalize to strip dots/dashes)
            const clDni = normalizeID(cl.dni);
            const newDni = normalizeID(newCl.dni);
            if (clDni && newDni && clDni !== newDni) return false;
            const clCuit = normalizeID(cl.cuit);
            const newCuit = normalizeID(newCl.cuit);
            if (clCuit && newCuit && clCuit !== newCuit) return false;
            return true;
        });

        if (existingIdx !== -1) {
            // MERGE: Keep stronger roles and combine data
            const existing = allClients[existingIdx];
            const rolePriority: Record<string, number> = { 'CEDENTE': 10, 'CESIONARIO': 10, 'ACREEDOR': 9, 'FIDUCIARIA': 9, 'DEUDOR': 8, 'VENDEDOR': 5, 'COMPRADOR': 5, 'APODERADO/REPRESENTANTE': 1 };

            if ((rolePriority[newCl.rol] || 0) > (rolePriority[existing.rol] || 0)) {
                existing.rol = newCl.rol;
            }
            existing.dni = existing.dni || newCl.dni;
            existing.cuit = existing.cuit || newCl.cuit;
            existing.domicilio_real = existing.domicilio_real || newCl.domicilio_real;
            existing.estado_civil = existing.estado_civil || newCl.estado_civil;
            existing.conyuge = existing.conyuge || newCl.conyuge;
            existing._representacion = existing._representacion || newCl._representacion;
        } else {
            allClients.push(newCl);
        }
    };

    if (raw.entidades && Array.isArray(raw.entidades)) {
        raw.entidades.forEach((e: any) => {
            const d = e.datos || {};
            const rawCuit = d.cuit_cuil?.valor?.toString()?.replace(/\D/g, '') || '';

            const isFideicomiso = e.tipo_entidad === 'FIDEICOMISO' ||
                (d.nombre_completo?.toString() || d.razon_social?.toString() || d.nombre?.toString() || '').toUpperCase().includes('FIDEICOMISO');

            const forcedTipoPersona = isFideicomiso ? 'FIDEICOMISO' : (e.tipo_persona || (['30', '33', '34'].some((p: any) => rawCuit.startsWith(p)) ? 'JURIDICA' : 'FISICA'));
            let rawNombre = isFideicomiso
                ? (extractString(d.nombre_completo, false) || extractString(d.razon_social, false) || 'Desconocido')
                : (extractString(d.nombre_completo) || 'Desconocido');

            // Handle combined Fideicomiso + Fiduciaria names
            if (isFideicomiso) {
                const trusteeIndicators = ['S.A.', 'SRL', 'SOCIEDAD ANONIMA', 'ADMINISTRADO POR', 'FIDUCIARIA'];
                const upperNombre = rawNombre.toUpperCase();
                for (const ind of trusteeIndicators) {
                    const idx = upperNombre.indexOf(ind);
                    if (idx !== -1) {
                        const trusteePart = rawNombre.substring(idx).trim();
                        rawNombre = rawNombre.substring(0, idx).trim();
                        addOrMergeClient({
                            rol: 'FIDUCIARIA',
                            tipo_persona: 'JURIDICA',
                            nombre_completo: trusteePart,
                            cuit: formatCUIT(extractString(d.cuit_fiduciaria || raw.fideicomiso?.fiduciaria?.cuit))
                        });
                        break;
                    }
                }
            }

            const mainClient = {
                rol: extractString(e.rol) || 'VENDEDOR',
                tipo_persona: forcedTipoPersona,
                nombre_completo: rawNombre,
                dni: normalizeID(extractString(d.dni)),
                cuit: formatCUIT(extractString(d.cuit_cuil)),
                cuit_tipo: e.cuit_tipo?.toUpperCase() || 'CUIT',
                estado_civil: extractString(d.estado_civil) || null,
                nacionalidad: extractString(d.nacionalidad) || null,
                fecha_nacimiento: extractString(d.fecha_nacimiento) || null,
                nombres_padres: extractString(d.nombres_padres) || null,
                domicilio_real: (d.domicilio?.valor || d.domicilio) ? { literal: extractString(d.domicilio?.valor || d.domicilio) } : null,
                datos_conyuge: d.conyuge ? {
                    nombre: extractString(d.conyuge.nombre_completo || d.conyuge.nombre) || null,
                    dni: extractString(d.conyuge.dni) || null,
                    cuit: extractString(d.conyuge.cuit_cuil) || null
                } : null
            };

            // Force Role check
            if (cedenteName && looseNameMatch(mainClient.nombre_completo, cedenteName)) mainClient.rol = 'CEDENTE';
            else if (cesionarioName && looseNameMatch(mainClient.nombre_completo, cesionarioName)) mainClient.rol = 'CESIONARIO';

            addOrMergeClient(mainClient);

            // Representatives
            if (e.representacion?.representantes) {
                e.representacion.representantes.forEach((rep: any) => {
                    addOrMergeClient({
                        rol: 'APODERADO/REPRESENTANTE',
                        caracter: rep.caracter || 'Apoderado',
                        nombre_completo: extractString(rep.nombre),
                        dni: normalizeID(extractString(rep.dni)),
                        tipo_persona: 'FISICA',
                        _representacion: {
                            representa_a: mainClient.nombre_completo,
                            caracter: rep.caracter || 'Apoderado',
                            poder_detalle: e.representacion.poder_detalle
                                || e.representacion.documento_base
                                || null
                        }
                    });
                });
            }
        });
    }

    // Final RESCUE logic inside normalization to ensure canonical list
    if (normalized.cesion_beneficiario) {
        const { cedente_nombre, cesionario_nombre, fideicomiso_nombre } = normalized.cesion_beneficiario;
        if (cedente_nombre) addOrMergeClient({ rol: 'CEDENTE', nombre_completo: cedente_nombre, tipo_persona: 'FISICA' });
        if (cesionario_nombre) addOrMergeClient({ rol: 'CESIONARIO', nombre_completo: cesionario_nombre, tipo_persona: 'FISICA' });
        if (fideicomiso_nombre) addOrMergeClient({ rol: 'VENDEDOR', nombre_completo: fideicomiso_nombre, tipo_persona: 'FIDEICOMISO' });
    }

    // SEMANTIC ROLE SANITIZER: Ultimo recurso para asegurar roles en 103.pdf y similares
    allClients.forEach(c => {
        const uName = c.nombre_completo.toUpperCase();

        // 1. Hardcore Anchors (Company specific or pattern based)
        if (uName.includes('SOMAJOFA')) c.rol = 'FIDUCIARIA';
        if (uName.includes('BANCO') || uName.includes('NACION AR')) c.rol = 'ACREEDOR';

        // 2. Fiduciary Vehicle check
        if (uName.includes('FIDEICOMISO')) {
            c.tipo_persona = 'FIDEICOMISO';
            if (c.rol === 'COMPRADOR') c.rol = 'VENDEDOR'; // Trusts are usually vendors in these deeds
        }

        // 3. Metadata matching (Cedente/Cesionario)
        if (cedenteName && looseNameMatch(c.nombre_completo, cedenteName)) {
            c.rol = 'CEDENTE';
        }
        if (cesionarioName && looseNameMatch(c.nombre_completo, cesionarioName)) {
            c.rol = 'CESIONARIO';
        }
    });

    // REPRESENTACION INFERENCE: For APODERADO clients without _representacion,
    // infer who they represent from entities with es_representado=true
    const representedEntities = (raw.entidades || []).filter((e: any) => e.representacion?.es_representado);
    allClients.forEach(c => {
        if (c._representacion) return; // already has it
        const rolUpper = (c.rol || '').toUpperCase();
        const isApoderado = rolUpper.includes('APODERADO') || rolUpper.includes('REPRESENTANTE') || rolUpper.includes('MANDATARIO') || rolUpper.includes('LETRADO');
        if (!isApoderado) return;

        // Find the entity this person represents
        for (const entity of representedEntities) {
            const reps = entity.representacion?.representantes || [];
            const match = reps.find((r: any) => looseNameMatch(extractString(r.nombre) || '', c.nombre_completo));
            if (match) {
                const entityName = extractString(entity.datos?.nombre_completo?.apellidos)
                    ? `${extractString(entity.datos?.nombre_completo?.apellidos)} ${extractString(entity.datos?.nombre_completo?.nombres)}`.trim()
                    : extractString(entity.datos?.razon_social) || extractString(entity.datos?.nombre_completo?.nombres) || '';
                c._representacion = {
                    representa_a: entityName,
                    caracter: match.caracter || 'Apoderado',
                    poder_detalle: entity.representacion.poder_detalle
                        || entity.representacion.documento_base
                        || null
                };
                break;
            }
        }

        // Fallback: if still no match, try to find any JURIDICA entity this person might represent
        if (!c._representacion) {
            const juridicas = allClients.filter((cl: any) => cl.tipo_persona === 'JURIDICA' || cl.tipo_persona === 'FIDEICOMISO');
            if (juridicas.length === 1) {
                c._representacion = {
                    representa_a: juridicas[0].nombre_completo,
                    caracter: 'Apoderado',
                    poder_detalle: null
                };
            }
        }
    });

    normalized.clientes = allClients;

    if (raw.inmuebles && Array.isArray(raw.inmuebles)) {
        const expandedInmuebles: any[] = [];
        for (const i of raw.inmuebles) {
            const rawPartido = i.partido?.valor || i.partido || 'Bahia Blanca';
            const rawPartida = i.partida_inmobiliaria?.valor || i.partida_inmobiliaria || '';
            const partido = normalizePartido(rawPartido);
            const nomenclatura = i.nomenclatura?.valor || i.nomenclatura;
            const transcripcion = i.transcripcion_literal?.valor || i.transcripcion_literal;
            const titulo = i.titulo_antecedente?.valor || i.titulo_antecedente || null;
            const valuacion = i.valuacion_fiscal?.valor || i.valuacion_fiscal || 0;

            // Split multiple partidas (e.g. "126-017.871-3 / 126-022.080")
            const partidas = splitMultiplePartidas(rawPartida);
            for (const p of partidas) {
                expandedInmuebles.push({
                    partido, partida_inmobiliaria: p, nomenclatura,
                    transcripcion_literal: transcripcion, titulo_antecedente: titulo,
                    valuacion_fiscal: valuacion
                });
            }
            // If no partidas found, still add with normalized empty
            if (partidas.length === 0) {
                expandedInmuebles.push({
                    partido, partida_inmobiliaria: normalizePartida(rawPartida), nomenclatura,
                    transcripcion_literal: transcripcion, titulo_antecedente: titulo,
                    valuacion_fiscal: valuacion
                });
            }
        }
        normalized.inmuebles = expandedInmuebles;
    }
    return normalized;
}


async function persistIngestedData(aiData: any, file: File, buffer: Buffer, existingFolderId: string) {
    console.log(`[PERSIST] Persisting data for folder ${existingFolderId}...`);
    const { clientes = [], inmuebles = [], resumen_acto, operation_details, numero_escritura } = aiData;
    const fileName = `documents/${Date.now()}_${file.name}`;
    const db_logs: string[] = [];
    let persistedClients = 0;
    let publicUrl = null;
    const conflicts: { type: 'PERSONA' | 'INMUEBLE', id: string, existing: any, extracted: any }[] = [];

    try {
        const { error: uploadError } = await supabaseAdmin.storage.from('escrituras').upload(fileName, buffer, { contentType: file.type });
        if (!uploadError) {
            const { data } = supabaseAdmin.storage.from('escrituras').getPublicUrl(fileName);
            publicUrl = data.publicUrl;
        }
    } catch (e) {
        console.warn("[PERSIST] Storage upload failed:", e);
    }

    const folderId = existingFolderId;
    let assetId = null;

    // Persist ALL inmuebles (first one = primary for escritura link)
    for (let idx = 0; idx < inmuebles.length; idx++) {
        const inm = inmuebles[idx];
        const partidoNorm = normalizePartido(inm.partido);
        const partidaNorm = normalizePartida(inm.partida_inmobiliaria);

        // --- SMART CHECK: Inmueble ---
        const { data: existingAsset } = await supabaseAdmin
            .from('inmuebles')
            .select('*')
            .eq('partido_id', partidoNorm)
            .eq('nro_partida', partidaNorm)
            .maybeSingle();

        if (existingAsset) {
            const hasChanges =
                existingAsset.nomenclatura !== inm.nomenclatura ||
                existingAsset.transcripcion_literal !== inm.transcripcion_literal;
            if (hasChanges) {
                conflicts.push({
                    type: 'INMUEBLE',
                    id: `${partidoNorm}-${partidaNorm}`,
                    existing: existingAsset,
                    extracted: inm
                });
            }
            if (idx === 0) assetId = existingAsset.id;
        } else {
            const { data: asset, error: assetError } = await supabaseAdmin.from('inmuebles').insert({
                partido_id: partidoNorm,
                nro_partida: partidaNorm,
                nomenclatura: inm.nomenclatura,
                transcripcion_literal: inm.transcripcion_literal,
                titulo_antecedente: inm.titulo_antecedente,
                valuacion_fiscal: inm.valuacion_fiscal
            }).select().single();

            if (assetError) {
                console.error(`[PERSIST] Error creating inmueble ${partidoNorm}/${partidaNorm}:`, assetError);
            } else if (idx === 0) {
                assetId = asset?.id;
            }
        }
    }

    // Build escritura object - FULL v1.1 usando nombres de columna reales
    const escrituraData: any = {
        carpeta_id: folderId,
        nro_protocolo: safeParseInt(aiData.numero_escritura),
        fecha_escritura: safeParseDate(aiData.fecha_escritura),
        registro: aiData.registro ? String(aiData.registro) : null,
        notario_interviniente: aiData.notario ? String(aiData.notario) : null,
        inmueble_princ_id: assetId, // Vinculando el inmueble principal
        pdf_url: publicUrl,
        analysis_metadata: JSON.parse(JSON.stringify(aiData)) // SANITIZACIÓN FORZADA
    };

    // DEDUP: Check if escritura with same protocolo+registro already exists
    let escritura: any = null;
    const nroProtocolo = safeParseInt(aiData.numero_escritura);
    const registro = aiData.registro ? String(aiData.registro) : null;

    if (nroProtocolo && registro) {
        const { data: existing } = await supabaseAdmin
            .from('escrituras')
            .select('*, operaciones(id)')
            .eq('nro_protocolo', nroProtocolo)
            .eq('registro', registro)
            .maybeSingle();

        if (existing) {
            console.log(`[PERSIST] ♻️ Escritura ${nroProtocolo}/${registro} already exists (${existing.id}), updating metadata`);
            // Update metadata but don't duplicate
            await supabaseAdmin.from('escrituras').update({
                analysis_metadata: JSON.parse(JSON.stringify(aiData)),
                pdf_url: publicUrl || existing.pdf_url,
                inmueble_princ_id: assetId || existing.inmueble_princ_id
            }).eq('id', existing.id);
            escritura = existing;
        }
    }

    if (!escritura) {
        const { data: newEscritura, error: escrituraError } = await supabaseAdmin.from('escrituras').insert(escrituraData).select().single();
        if (escrituraError || !newEscritura) {
            console.error('[PERSIST] ❌ Error creating escritura:', escrituraError);
            return { success: false, error: `Error creando escritura: ${escrituraError?.message || 'Unknown'}` };
        }
        escritura = newEscritura;
    }

    // DEDUP: Check if operacion already exists for this escritura
    let operacion: any = null;
    const existingOps = escritura.operaciones || [];
    if (existingOps.length > 0) {
        operacion = existingOps[0]; // Reuse existing
        console.log(`[PERSIST] ♻️ Operación already exists (${operacion.id}), reusing`);
        // Update with latest data
        await supabaseAdmin.from('operaciones').update({
            tipo_acto: String(resumen_acto || 'COMPRAVENTA').toUpperCase().substring(0, 100),
            monto_operacion: parseFloat(String(operation_details?.price || 0)) || 0,
            codigo: getCESBACode(resumen_acto, !!operation_details?.is_family_home) || null
        }).eq('id', operacion.id);
    } else {
        const { data: newOp, error: opError } = await supabaseAdmin.from('operaciones').insert([{
            escritura_id: escritura.id,
            tipo_acto: String(resumen_acto || 'COMPRAVENTA').toUpperCase().substring(0, 100),
            monto_operacion: parseFloat(String(operation_details?.price || 0)) || 0,
            codigo: getCESBACode(resumen_acto, !!operation_details?.is_family_home) || null,
            precio_construccion: operation_details?.precio_construccion || null,
            precio_cesion: operation_details?.precio_cesion || null,
            moneda_cesion: operation_details?.currency?.includes('USD') ? 'USD' : 'ARS',
            tipo_cambio_cesion: operation_details?.tipo_cambio_cesion || null,
            equivalente_ars_cesion: operation_details?.equivalente_ars_cesion || null,
            beneficiario_cedente: aiData.cesion_beneficiario?.cedente_nombre || null,
            beneficiario_cesionario: aiData.cesion_beneficiario?.cesionario_nombre || null,
            fecha_cesion: safeParseDate(aiData.cesion_beneficiario?.fecha_cesion) || null
        }]).select().single();
        if (opError) db_logs.push(`Op Error: ${opError.message}`);
        operacion = newOp;
    }

    const processedParticipants = new Set<string>();

    // SAFETY NET: Ensure APODERADO clients have _representacion before persisting
    const juridicaClients = clientes.filter((cl: any) => cl.tipo_persona === 'JURIDICA' || cl.tipo_persona === 'FIDEICOMISO');
    for (const c of clientes) {
        if (c._representacion) continue;
        const rolUpper = (c.rol || '').toUpperCase();
        const isApoderado = rolUpper.includes('APODERADO') || rolUpper.includes('REPRESENTANTE') || rolUpper.includes('MANDATARIO') || rolUpper.includes('LETRADO');
        if (!isApoderado) continue;
        if (juridicaClients.length === 1) {
            c._representacion = {
                representa_a: juridicaClients[0].nombre_completo,
                caracter: 'Apoderado',
                poder_detalle: null
            };
        } else if (juridicaClients.length > 1) {
            // Multiple juridicas: pick the one with ACREEDOR role (common in hipotecas)
            const acreedor = juridicaClients.find((j: any) => j.rol?.toUpperCase()?.includes('ACREEDOR'));
            if (acreedor) {
                c._representacion = {
                    representa_a: acreedor.nombre_completo,
                    caracter: 'Apoderado',
                    poder_detalle: null
                };
            }
        }
    }

    // Participants are now fully normalized in allClients
    for (const c of clientes) {
        const cleanDni = normalizeID(c.dni);
        const cleanCuit = normalizeID(c.cuit);
        const isJuridica = c.tipo_persona === 'JURIDICA' || c.tipo_persona === 'FIDEICOMISO';

        // JURIDICA: CUIT is the canonical ID (no DNI). FISICA: DNI first, CUIT fallback.
        let finalID = isJuridica ? (cleanCuit || cleanDni) : (cleanDni || cleanCuit);

        if (!finalID) {
            // FALLBACK for CEDENTES, FIDEICOMISOS or other critical actors without ID in the text
            const role = String(c.rol).toUpperCase();
            const type = String(c.tipo_persona).toUpperCase();
            if (role === 'CEDENTE' || role === 'PROPIETARIO ANTERIOR' || role === 'VENDEDOR' || role === 'FIDUCIARIA' || type === 'FIDEICOMISO') {
                finalID = `TEMP-${Date.now()}-${c.nombre_completo.substring(0, 5).toUpperCase().replace(/\W/g, '')}`;
                console.log(`[PERSIST] Entity ${c.nombre_completo} (Role: ${role}, Type: ${type}) has no ID, generated fallback: ${finalID}`);
            } else {
                console.warn(`[PERSIST] Skipping entity ${c.nombre_completo} - NO ID (DNI/CUIT)`);
                continue;
            }
        }

        // --- SMART CHECK: Persona ---
        const { data: existingPerson } = await supabaseAdmin
            .from('personas')
            .select('*')
            .eq('dni', finalID)
            .maybeSingle();

        const extractedPersona = {
            dni: finalID,
            tipo_persona: c.tipo_persona || 'FISICA',  // NEW: Add tipo_persona
            nombre_completo: c.nombre_completo,
            cuit: normalizeID(c.cuit),
            cuit_tipo: c.cuit_tipo || 'CUIT',
            cuit_is_formal: c.cuit_is_formal ?? true,
            nacionalidad: c.nacionalidad ? toTitleCase(c.nacionalidad) : null,
            fecha_nacimiento: safeParseDate(c.fecha_nacimiento),
            domicilio_real: c.domicilio_real,
            estado_civil_detalle: c.estado_civil || null,
            nombres_padres: c.nombres_padres || null,
            datos_conyuge: c.datos_conyuge || null
        };

        if (existingPerson) {
            // Compare critical fields: address, marital status, full name
            const addressChanged = existingPerson.domicilio_real?.literal !== extractedPersona.domicilio_real?.literal;
            const statusChanged = existingPerson.estado_civil_detalle !== extractedPersona.estado_civil_detalle;
            const nameChanged = existingPerson.nombre_completo !== extractedPersona.nombre_completo;

            if (addressChanged || statusChanged || nameChanged) {
                conflicts.push({
                    type: 'PERSONA',
                    id: finalID,
                    existing: existingPerson,
                    extracted: extractedPersona
                });
            }
        }

        const { error: pError } = await supabaseAdmin.from('personas').upsert({
            ...extractedPersona,
            origen_dato: 'IA_OCR',
            updated_at: new Date().toISOString()
        }, { onConflict: 'dni' });

        if (pError) db_logs.push(`Person Error (${finalID}): ${pError.message}`);
        else {
            persistedClients++;
            if (operacion) {
                const participantKey = `${operacion.id}-${finalID}`;
                if (!processedParticipants.has(participantKey)) {
                    // Use upsert with ON CONFLICT DO NOTHING to prevent duplicates
                    const repData = (c as any)._representacion || null;
                    const { error: partErr } = await supabaseAdmin.from('participantes_operacion').upsert({
                        operacion_id: operacion.id,
                        persona_id: finalID,
                        rol: String(c.caracter ? `${c.rol} (${c.caracter})` : c.rol).toUpperCase().substring(0, 150),
                        datos_representacion: repData
                    }, { onConflict: 'operacion_id,persona_id', ignoreDuplicates: true });
                    if (partErr) db_logs.push(`Participant Error (${finalID}): ${partErr.message}`);
                    processedParticipants.add(participantKey);
                }
            }
        }
    }

    // --- STEP: Spouse Symmetry (if Person A has spouse B, ensure B has A) ---
    for (const c of clientes) {
        const personId = normalizeID(c.dni || c.cuit);
        if (!personId) continue;

        if (c.datos_conyuge && (c.datos_conyuge.dni || c.datos_conyuge.cuit)) {
            const spouseId = normalizeID(c.datos_conyuge.dni || c.datos_conyuge.cuit);
            if (!spouseId) continue;

            const { data: personData } = await supabaseAdmin.from('personas').select('nombre_completo').eq('dni', personId).single();

            if (personData) {
                // Update spouse record with personData's info (mirror effect)
                await supabaseAdmin.from('personas').update({
                    datos_conyuge: {
                        nombre: personData.nombre_completo,
                        dni: personId,
                        nombre_completo: personData.nombre_completo
                    }
                }).eq('dni', spouseId);
            }
        }
    }

    // If there are conflicts, update the folder status and save the conflicts metadata
    if (conflicts.length > 0) {
        await supabaseAdmin.from('carpetas').update({
            ingesta_estado: 'REVISION_REQUERIDA',
            ingesta_metadata: { conflicts }
        }).eq('id', folderId);
    }

    return {
        folderId,
        success: true,
        persistedClients: processedParticipants.size,
        db_logs,
        error: null,
        fileName,
        hasConflicts: conflicts.length > 0
    };
}

export async function GET() { return NextResponse.json({ status: "alive" }); }
