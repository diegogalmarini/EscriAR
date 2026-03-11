/**
 * Re-extract ONLY codigo_acto for all escrituras using Gemini + full CESBA taxonomy.
 * Downloads each PDF, asks Gemini to determine the exact CESBA code with correct
 * fiscal suffix, and updates the database.
 *
 * Usage: npx tsx scripts/reextract_codigos.ts
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const GEMINI_KEY = process.env.GEMINI_API_KEY!;

if (!GEMINI_KEY) { console.error('GEMINI_API_KEY not found'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const googleAI = new GoogleGenerativeAI(GEMINI_KEY);

// Load the FULL acts taxonomy
const taxonomyPath = path.resolve(__dirname, '../src/data/acts_taxonomy_2026.json');
const taxonomy: Record<string, { description: string; act_name?: string }> = JSON.parse(fs.readFileSync(taxonomyPath, 'utf-8'));

// Build a condensed reference string for the prompt
function buildTaxonomyReference(): string {
    const lines: string[] = [];
    // Group by base code
    const groups: Record<string, { code: string; desc: string }[]> = {};
    for (const [code, entry] of Object.entries(taxonomy)) {
        const base = code.split('-')[0];
        if (!groups[base]) groups[base] = [];
        groups[base].push({ code, desc: entry.description || entry.act_name || '' });
    }

    for (const [base, items] of Object.entries(groups).sort()) {
        // Only include the base codes relevant to notarial practice
        // Skip certificate codes (750+) and info codes
        const baseNum = parseInt(base);
        if (baseNum >= 750 && baseNum < 800) continue; // certificados e informes

        for (const item of items) {
            lines.push(`${item.code}: ${item.desc}`);
        }
    }
    return lines.join('\n');
}

const TAXONOMY_REF = buildTaxonomyReference();

const PROMPT = `Eres un escribano argentino experto en la Tabla de Actos del CESBA (Colegio de Escribanos de Buenos Aires).

Tu tarea: dado el contenido de una escritura pública, determinar el CÓDIGO CESBA EXACTO que corresponde.

FORMATO DEL CÓDIGO: "NNN-SS" donde:
- NNN = código base del tipo de acto
- SS = sufijo fiscal que indica tratamiento impositivo

SIGNIFICADO DE LOS SUFIJOS FISCALES:
- 00 = Gravada normal (paga impuesto de sellos + aportes de terceros)
- 01 = Sujeta al pago de imp. de sellos / 1 parte exenta de aportes de terceros
- 10 = 1 parte exenta de impuesto de sellos
- 11 = 1 parte exenta de imp. sellos + 1 parte exenta aportes terceros
- 20 = Exenta de impuesto de sellos
- 21 = Exenta de imp. sellos + 1 parte exenta de aportes terceros
- 22 = Exenta de impuesto de sellos + exenta de aportes de terceros
- 24 = Régimen especial (regularización dominial, planes sociales)
- 30 = Gratuita (inmuebles) / No gravada con monto
- 31 = No gravada imp. sellos + 1 parte exenta aportes
- 32 = No gravada de impuesto de sellos + exenta de aportes de terceros
- 34 = Planes sociales de vivienda
- 42 = Por agencia (automotores)
- 51 = Vivienda única - exención total de sellos
- 52 = Vivienda única con V.F. mayor al valor de exención

CÓMO DETERMINAR EL SUFIJO:
1. Lee la escritura buscando menciones a:
   - "exento/exenta de impuesto de sellos" → sufijo 20
   - "exenta de sellos y exenta de aportes" → sufijo 22
   - "no gravado/no gravada" → sufijo 30 o 32
   - "vivienda única" o "exención total sellos" → sufijo 51
   - "1 parte exenta" → sufijo 10 o 11
   - Si no menciona exenciones → sufijo 00 (el default para actos onerosos)
   - Si es un acto gratuito (donación, renuncia, poder, acta) → sufijo 30 o 32

2. Actos que SIEMPRE usan ciertos sufijos:
   - PODERES, ACTAS: siempre 800-32 (no gravados)
   - AFECTACIÓN/DESAFECTACIÓN VIVIENDA: 500-32 / 501-32
   - OBRA NUEVA: 515-30
   - AFECTACIÓN P.H.: 512-30
   - COMPLEMENTARIA: 702-20
   - ANOTACIÓN MARGINAL: 701-22
   - TRACTO ABREVIADO (solo): 713-00

3. Para ACTOS COMPUESTOS (ej: compraventa + tracto abreviado, venta + renuncia de usufructo):
   Separar con " / ". Ej: "100-00 / 713-00"

TABLA COMPLETA DE CÓDIGOS CESBA:
${TAXONOMY_REF}

INSTRUCCIONES:
- Devolver SOLO el código CESBA exacto, nada más.
- Si es un acto compuesto, separar con " / ".
- Si la escritura está anulada o no pasó: "999-00".
- El código DEBE existir en la tabla de arriba.`;

const RESPONSE_SCHEMA = {
    type: 'object' as const,
    properties: {
        codigo_acto: {
            type: 'string' as const,
            description: 'Código CESBA exacto. Formato NNN-SS. Para compuestos: "NNN-SS / NNN-SS"',
        },
        razonamiento: {
            type: 'string' as const,
            description: 'Breve explicación de por qué elegiste este código (max 100 chars)',
        },
    },
    required: ['codigo_acto', 'razonamiento'],
};

async function extractCodigoFromPdf(pdfBuffer: Buffer, nroEscritura: number, tipoActo: string): Promise<{ codigo: string; razon: string } | null> {
    const pdfParse = require('pdf-parse');

    let textContent = '';
    try {
        const parsed = await pdfParse(pdfBuffer);
        textContent = parsed.text || '';
    } catch { /* ignore */ }

    const hasText = textContent.trim().length > 200;

    const model = googleAI.getGenerativeModel({
        model: 'gemini-3-flash-preview',
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA as any,
        },
    });

    const contextInfo = `\n\nESCRITURA N° ${nroEscritura} - Tipo de acto registrado: "${tipoActo}"\n`;

    let result;
    if (hasText) {
        // Text-based extraction
        result = await model.generateContent([
            { text: PROMPT + contextInfo + `\nCONTENIDO DE LA ESCRITURA:\n${textContent.substring(0, 80000)}` },
        ]);
    } else {
        // PDF-native extraction
        result = await model.generateContent([
            { text: PROMPT + contextInfo + `\nAnaliza el documento PDF adjunto y determina el código CESBA correcto.` },
            {
                inlineData: {
                    data: pdfBuffer.toString('base64'),
                    mimeType: 'application/pdf',
                },
            },
        ]);
    }

    const responseText = result.response.text();
    try {
        const parsed = JSON.parse(responseText);
        return { codigo: parsed.codigo_acto, razon: parsed.razonamiento || '' };
    } catch {
        console.error(`    ⚠ Failed to parse response: ${responseText.substring(0, 200)}`);
        return null;
    }
}

// Validate that the code exists in taxonomy
const VALID_CODE_PATTERN = /^\d{3}-\d{2}(\s*\/\s*\d{3}-\d{2})*$/;
function validateCode(code: string): boolean {
    if (!VALID_CODE_PATTERN.test(code)) return false;
    const parts = code.split(/\s*\/\s*/);
    return parts.every(p => taxonomy[p] !== undefined);
}

async function main() {
    console.log('══════════════════════════════════════════════════');
    console.log('  RE-EXTRACT CODIGO_ACTO FROM ALL PDFs');
    console.log('══════════════════════════════════════════════════\n');

    // Get all registros with PDFs
    const { data: registros, error } = await supabase
        .from('protocolo_registros')
        .select('id, nro_escritura, tipo_acto, codigo_acto, pdf_storage_path, es_errose')
        .order('nro_escritura', { ascending: true });

    if (error || !registros) {
        console.error('Error fetching registros:', error);
        return;
    }

    const withPdf = registros.filter(r => r.pdf_storage_path && !r.es_errose && r.tipo_acto);
    console.log(`📊 Total registros: ${registros.length}, con PDF: ${withPdf.length}\n`);

    let updated = 0;
    let unchanged = 0;
    let failed = 0;

    for (const reg of withPdf) {
        const nro = reg.nro_escritura;
        console.log(`── Esc ${nro}: "${reg.tipo_acto}" (actual: ${reg.codigo_acto || 'null'}) ──`);

        // Download PDF
        const { data: fileData, error: dlErr } = await supabase.storage
            .from('protocolo')
            .download(reg.pdf_storage_path);

        if (dlErr || !fileData) {
            console.log(`    ⚠ Error downloading PDF: ${dlErr?.message}`);
            failed++;
            continue;
        }

        const buffer = Buffer.from(await fileData.arrayBuffer());
        console.log(`    ✓ PDF descargado (${(buffer.length / 1024).toFixed(0)} KB)`);

        // Extract with Gemini
        try {
            const result = await extractCodigoFromPdf(buffer, nro, reg.tipo_acto);

            if (!result) {
                console.log(`    ⚠ No result from Gemini`);
                failed++;
                continue;
            }

            const { codigo, razon } = result;

            if (!validateCode(codigo)) {
                console.log(`    ⚠ Invalid code "${codigo}" (not in taxonomy) — ${razon}`);
                // Keep existing code if it was valid
                failed++;
                continue;
            }

            if (codigo === reg.codigo_acto) {
                console.log(`    = Sin cambio: ${codigo} — ${razon}`);
                unchanged++;
            } else {
                // Update
                const { error: upErr } = await supabase
                    .from('protocolo_registros')
                    .update({ codigo_acto: codigo })
                    .eq('id', reg.id);

                if (upErr) {
                    console.log(`    ⚠ Error updating: ${upErr.message}`);
                    failed++;
                } else {
                    console.log(`    ✓ ACTUALIZADO: ${reg.codigo_acto || 'null'} → ${codigo} — ${razon}`);
                    updated++;
                }
            }
        } catch (err: any) {
            console.log(`    ⚠ Error: ${err.message}`);
            failed++;
        }

        // Rate limit pause
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`\n══════════════════════════════════════════════════`);
    console.log(`  RESUMEN:`);
    console.log(`  ✓ Actualizados: ${updated}`);
    console.log(`  = Sin cambio: ${unchanged}`);
    console.log(`  ✗ Fallidos: ${failed}`);
    console.log(`══════════════════════════════════════════════════`);
}

main().catch(console.error);
