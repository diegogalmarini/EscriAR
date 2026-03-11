/**
 * Audit all codigo_acto values in protocolo_registros against the acts_taxonomy.
 * Reports mismatches and provides correct codes where possible.
 *
 * Usage: npx tsx scripts/audit_codigos.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Load acts taxonomy
const taxonomyPath = path.resolve(__dirname, '../src/data/acts_taxonomy_2026.json');
const taxonomy: Record<string, { description: string; act_name: string; category: string }> = JSON.parse(fs.readFileSync(taxonomyPath, 'utf-8'));

// Build reverse mapping: base code → all sub-codes
const allCodes = Object.keys(taxonomy);
const baseGroups: Record<string, { code: string; desc: string }[]> = {};
for (const code of allCodes) {
    const base = code.split('-')[0];
    if (!baseGroups[base]) baseGroups[base] = [];
    baseGroups[base].push({ code, desc: taxonomy[code].description || taxonomy[code].act_name });
}

async function main() {
    console.log('══════════════════════════════════════════════════');
    console.log('  AUDIT CODIGO_ACTO');
    console.log('══════════════════════════════════════════════════\n');

    // Print all available codes for reference
    console.log('── AVAILABLE CODES IN TAXONOMY ──\n');
    for (const [base, items] of Object.entries(baseGroups).sort()) {
        for (const item of items) {
            console.log(`  ${item.code}: ${item.desc}`);
        }
    }
    console.log(`\n  Total: ${allCodes.length} codes\n`);

    // Fetch all registros
    const { data: registros, error } = await supabase
        .from('protocolo_registros')
        .select('id, nro_escritura, tipo_acto, codigo_acto, es_errose')
        .order('nro_escritura', { ascending: true });

    if (error || !registros) {
        console.error('Error:', error);
        return;
    }

    console.log('── CURRENT REGISTROS ──\n');

    let validCount = 0;
    let invalidCount = 0;
    let missingCount = 0;
    let issues: string[] = [];

    for (const reg of registros) {
        const code = reg.codigo_acto?.trim() || null;
        const tipoActo = reg.tipo_acto || '';
        const isErrose = reg.es_errose;

        // Skip errose entries
        if (isErrose || tipoActo.toLowerCase().includes('errose')) {
            console.log(`  Esc ${reg.nro_escritura}: [ERROSE] — skipped`);
            continue;
        }

        if (!code) {
            missingCount++;
            console.log(`  Esc ${reg.nro_escritura}: ⚠ NO CODE — "${tipoActo}"`);
            continue;
        }

        // Check if code exists in taxonomy
        // Handle compound codes like "100-00 / 713-00"
        const codeParts = code.split(/\s*\/\s*/);
        let allValid = true;
        for (const part of codeParts) {
            if (!taxonomy[part]) {
                allValid = false;
            }
        }

        // Check if base code matches tipo_acto category
        const baseCode = codeParts[0].split('-')[0];

        const status = allValid ? '✓' : '✗';
        const taxonomyDesc = codeParts.map(c => taxonomy[c]?.description || '???').join(' / ');

        console.log(`  Esc ${String(reg.nro_escritura).padStart(2)}: ${status} ${code.padEnd(18)} "${tipoActo}" → [${taxonomyDesc}]`);

        if (allValid) {
            validCount++;
        } else {
            invalidCount++;
            issues.push(`  Esc ${reg.nro_escritura}: "${code}" not in taxonomy — "${tipoActo}"`);
        }
    }

    console.log(`\n── SUMMARY ──`);
    console.log(`  Valid (in taxonomy): ${validCount}`);
    console.log(`  Invalid (not in taxonomy): ${invalidCount}`);
    console.log(`  Missing (no code): ${missingCount}`);
    console.log(`  Total: ${registros.length}\n`);

    if (issues.length > 0) {
        console.log('── ISSUES ──');
        issues.forEach(i => console.log(i));
    }
}

main().catch(console.error);
