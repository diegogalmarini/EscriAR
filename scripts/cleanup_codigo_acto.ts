/**
 * One-time cleanup: fix invalid codigo_acto values in protocolo_registros.
 *
 * Valid format: "NNN-SS" (e.g., "100-00", "300-22", "100-00 / 713-00")
 * Invalid values like "1", "001", "003", "08", "049" get re-derived from tipo_acto.
 *
 * Usage: npx tsx scripts/cleanup_codigo_acto.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Inline the classifier (same logic as src/lib/actClassifier.ts)
type Rule = { pattern: RegExp; code: string };

const RULES: Rule[] = [
    { pattern: /no\s*pas[oó]/i, code: "999-00" },
    { pattern: /anulad[ao]/i, code: "999-00" },
    { pattern: /venta.*t\.?\s*a\.?|compraventa.*tracto/i, code: "100-00 / 713-00" },
    { pattern: /venta.*ext\.?\s*usuf/i, code: "100-00 / 401-30" },
    { pattern: /venta.*renun.*usuf/i, code: "100-00 / 414-30" },
    { pattern: /venta.*cancel.*hip/i, code: "100-00 / 311-00" },
    { pattern: /venta.*hip[oó]t/i, code: "100-00 / 300-00" },
    { pattern: /compraventa|^venta/i, code: "100-00" },
    { pattern: /tracto\s*abrev/i, code: "713-00" },
    { pattern: /donac/i, code: "200-30" },
    { pattern: /cancel.*hip[oó]t/i, code: "311-00" },
    { pattern: /cont.*cr[eé]d.*hip|hip[oó]t.*cr[eé]d|const.*hip/i, code: "300-00" },
    { pattern: /hip[oó]t/i, code: "300-00" },
    { pattern: /renun.*usuf/i, code: "414-30" },
    { pattern: /ext.*usuf/i, code: "401-30" },
    { pattern: /const.*usuf|usufruct/i, code: "400-00" },
    { pattern: /desaf.*vivien/i, code: "501-30" },
    { pattern: /afect.*vivien/i, code: "500-32" },
    { pattern: /reglam.*p\.?\s*h|afect.*horiz/i, code: "512-30" },
    { pattern: /adj.*disol.*soc.*cony|disol.*soc.*cony/i, code: "709-00" },
    { pattern: /adj.*liq.*fideicom/i, code: "121-51" },
    { pattern: /adj.*parti|partic.*herenc/i, code: "716-00" },
    { pattern: /ces.*der.*her.*s.*inm.*oner/i, code: "720-00" },
    { pattern: /ces.*der.*her/i, code: "700-00" },
    { pattern: /declarator.*hered/i, code: "707-00" },
    { pattern: /renun.*herenc/i, code: "730-00" },
    { pattern: /inscr.*declarator/i, code: "707-00" },
    { pattern: /divis.*condom/i, code: "705-00" },
    { pattern: /const.*soc|soc.*const/i, code: "600-20" },
    { pattern: /protocol.*disol|adj.*liq.*soc/i, code: "606-00" },
    { pattern: /fusi[oó]n.*soc/i, code: "605-00" },
    { pattern: /transf.*soc|reform.*estat/i, code: "604-00" },
    { pattern: /transf.*fiduc|fideic/i, code: "108-30" },
    { pattern: /transf.*benef/i, code: "121-00" },
    { pattern: /daci[oó]n.*pago/i, code: "110-00" },
    { pattern: /permut/i, code: "107-00" },
    { pattern: /distract/i, code: "105-00" },
    { pattern: /complement|aclarator|rectificat/i, code: "702-00" },
    { pattern: /anot.*marg/i, code: "701-00" },
    { pattern: /segund.*testim|2.*testim/i, code: "708-00" },
    { pattern: /obra\s*nuev/i, code: "515-00" },
    { pattern: /servidum/i, code: "404-00" },
    { pattern: /cancel/i, code: "311-00" },
    { pattern: /ces.*der.*acc/i, code: "902-00" },
    { pattern: /ces.*bol/i, code: "825-00" },
    { pattern: /ces.*cuot/i, code: "604-00" },
    { pattern: /bolet.*compra/i, code: "824-02" },
    { pattern: /locac|contrat.*locac/i, code: "857-02" },
    { pattern: /autom.*nuev|formul.*08/i, code: "813-02" },
    { pattern: /autom.*usad/i, code: "814-02" },
    { pattern: /protocol/i, code: "875-30" },
    { pattern: /reconoc.*deud/i, code: "879-30" },
    { pattern: /testam/i, code: "800-32" },
    { pattern: /convenc.*matrim|pacto.*conviv/i, code: "801-00" },
    { pattern: /bonific|compens/i, code: "900-00" },
    { pattern: /desembols/i, code: "300-00" },
    { pattern: /^acta|acta\b/i, code: "800-32" },
    { pattern: /poder|pod\b|pod\./i, code: "800-32" },
    { pattern: /renta\s*vital/i, code: "410-00" },
    { pattern: /prend/i, code: "866-00" },
    { pattern: /leasing/i, code: "109-00" },
];

function classifyActo(tipoActo: string): string | null {
    if (!tipoActo?.trim()) return null;
    const normalized = tipoActo.trim();
    for (const rule of RULES) {
        if (rule.pattern.test(normalized)) return rule.code;
    }
    return null;
}

// Valid codigo_acto format: "NNN-SS" possibly with " / NNN-SS" for compound acts
const VALID_CODE_PATTERN = /^\d{3}-\d{2}(\s*\/\s*\d{3}-\d{2})*$/;

function isValidCode(code: string | null): boolean {
    if (!code) return false;
    return VALID_CODE_PATTERN.test(code.trim());
}

async function main() {
    console.log('══════════════════════════════════════════════════');
    console.log('  CLEANUP CODIGO_ACTO');
    console.log('══════════════════════════════════════════════════\n');

    const { data: registros, error } = await supabase
        .from('protocolo_registros')
        .select('id, nro_escritura, tipo_acto, codigo_acto')
        .order('nro_escritura', { ascending: true });

    if (error || !registros) {
        console.error('Error fetching registros:', error);
        return;
    }

    console.log(`📊 Total registros: ${registros.length}\n`);

    let fixedCount = 0;
    let alreadyValid = 0;
    let derivedCount = 0;
    let noMatch = 0;

    for (const reg of registros) {
        const currentCode = reg.codigo_acto?.trim() || null;
        const valid = isValidCode(currentCode);

        if (valid) {
            alreadyValid++;
            continue;
        }

        // Derive from tipo_acto
        const derived = classifyActo(reg.tipo_acto);

        if (derived) {
            const { error: upErr } = await supabase
                .from('protocolo_registros')
                .update({ codigo_acto: derived })
                .eq('id', reg.id);

            if (upErr) {
                console.error(`  ⚠ Error updating esc ${reg.nro_escritura}: ${upErr.message}`);
            } else {
                const oldDisplay = currentCode || '(null)';
                console.log(`  ✓ Esc ${reg.nro_escritura}: "${oldDisplay}" → "${derived}" (${reg.tipo_acto})`);
                fixedCount++;
                derivedCount++;
            }
        } else {
            if (currentCode) {
                console.log(`  ⚠ Esc ${reg.nro_escritura}: invalid "${currentCode}" but no match for "${reg.tipo_acto}"`);
            }
            noMatch++;
        }
    }

    console.log(`\n── Summary ──`);
    console.log(`  Already valid: ${alreadyValid}`);
    console.log(`  Fixed (derived from tipo_acto): ${fixedCount}`);
    console.log(`  No match (needs manual review): ${noMatch}`);
    console.log(`  Total: ${registros.length}\n`);

    console.log('══════════════════════════════════════════════════');
    console.log('  DONE');
    console.log('══════════════════════════════════════════════════');
}

main().catch(console.error);
