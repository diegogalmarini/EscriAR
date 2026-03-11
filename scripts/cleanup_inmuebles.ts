/**
 * One-time cleanup script for inmuebles table:
 * 1. Normalize partido_id (strip "(007)" suffixes, use canonical names, fix casing)
 * 2. Set partido_code/delegacion_code where missing
 * 3. Merge duplicate records (same partido + partida after normalization)
 * 4. Handle CABA specially
 *
 * Usage: npx tsx scripts/cleanup_inmuebles.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Jurisdiction Resolver ──
interface JurisdictionParty {
    name: string;
    code: string;
    delegation_code: string;
    aliases: string[];
}

const ACCENT_MAP: Record<string, string> = {
    'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n', 'ü': 'u',
    'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ñ': 'N', 'Ü': 'U',
};

function stripAccents(s: string): string {
    return s.replace(/[áéíóúñüÁÉÍÓÚÑÜ]/g, ch => ACCENT_MAP[ch] || ch);
}

const jsonPath = path.resolve(__dirname, '../src/data/pba_2026_jurisdictions.json');
const jurisdictionData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
const parties: JurisdictionParty[] = jurisdictionData.parties;

const SPECIAL_JURISDICTIONS: Record<string, { canonicalName: string; code: string; delegationCode: string }> = {
    'ciudad autonoma de buenos aires': { canonicalName: 'Ciudad Autónoma de Buenos Aires', code: 'CABA', delegationCode: 'CABA' },
    'caba': { canonicalName: 'Ciudad Autónoma de Buenos Aires', code: 'CABA', delegationCode: 'CABA' },
    'capital federal': { canonicalName: 'Ciudad Autónoma de Buenos Aires', code: 'CABA', delegationCode: 'CABA' },
};

function normalizePartido(rawPartido: string): {
    canonicalName: string;
    partyCode: string | null;
    delegationCode: string | null;
} {
    if (!rawPartido) return { canonicalName: rawPartido, partyCode: null, delegationCode: null };

    // Strip "(XXX)" suffixes like "(007)"
    let cleaned = rawPartido.replace(/\s*\(\d+\)\s*$/, '').trim();
    const needle = stripAccents(cleaned.toLowerCase());

    // Check special jurisdictions
    const special = SPECIAL_JURISDICTIONS[needle];
    if (special) return { canonicalName: special.canonicalName, partyCode: special.code, delegationCode: special.delegationCode };

    // Exact alias match
    for (const p of parties) {
        if (p.aliases.some(a => stripAccents(a.toLowerCase()) === needle)) {
            return { canonicalName: p.name, partyCode: p.code, delegationCode: p.delegation_code };
        }
    }
    // Partial match
    for (const p of parties) {
        const normName = stripAccents(p.name.toLowerCase());
        if (normName.includes(needle) || needle.includes(normName)) {
            return { canonicalName: p.name, partyCode: p.code, delegationCode: p.delegation_code };
        }
    }

    console.log(`  ⚠ No jurisdiction match for: "${rawPartido}"`);
    return { canonicalName: cleaned, partyCode: null, delegationCode: null };
}

async function main() {
    console.log('══════════════════════════════════════════════════');
    console.log('  CLEANUP INMUEBLES - Normalize & Deduplicate');
    console.log('══════════════════════════════════════════════════\n');

    // Fetch ALL inmuebles
    const { data: allInmuebles, error } = await supabase
        .from('inmuebles')
        .select('id, partido_id, partido_code, delegacion_code, nro_partida, nomenclatura, transcripcion_literal, titulo_antecedente, valuacion_fiscal')
        .order('partido_id', { ascending: true });

    if (error || !allInmuebles) {
        console.error('Error fetching inmuebles:', error);
        return;
    }

    console.log(`📊 Total inmuebles: ${allInmuebles.length}\n`);

    // ── Build groups by normalized (partido, partida) ──
    // Each group will be resolved to a single canonical record
    type InmuebleRow = typeof allInmuebles[0];
    const groups = new Map<string, { canonical: ReturnType<typeof normalizePartido>; records: InmuebleRow[] }>();

    for (const inm of allInmuebles) {
        if (!inm.partido_id || !inm.nro_partida) continue;
        const resolved = normalizePartido(inm.partido_id);
        const key = `${resolved.canonicalName}||${inm.nro_partida}`;
        if (!groups.has(key)) {
            groups.set(key, { canonical: resolved, records: [] });
        }
        groups.get(key)!.records.push(inm);
    }

    // Also handle records without nro_partida (just normalize their partido_id)
    const noPartida = allInmuebles.filter(i => !i.nro_partida && i.partido_id);

    console.log(`  Groups: ${groups.size} unique (partido, partida) combinations`);
    console.log(`  Records without partida: ${noPartida.length}\n`);

    // ── Process each group ──
    let normalizedCount = 0;
    let mergedCount = 0;
    let deletedCount = 0;

    for (const [key, { canonical, records }] of groups) {
        // Sort: prefer records that already have nomenclatura, partido_code, more data
        records.sort((a, b) => {
            if (a.nomenclatura && !b.nomenclatura) return -1;
            if (!a.nomenclatura && b.nomenclatura) return 1;
            if (a.partido_code && !b.partido_code) return -1;
            if (!a.partido_code && b.partido_code) return 1;
            const aFields = [a.transcripcion_literal, a.titulo_antecedente, a.valuacion_fiscal].filter(Boolean).length;
            const bFields = [b.transcripcion_literal, b.titulo_antecedente, b.valuacion_fiscal].filter(Boolean).length;
            return bFields - aFields;
        });

        const keeper = records[0];
        const duplicates = records.slice(1);

        // Build the ideal merged state
        const updates: Record<string, any> = {};

        // Normalize partido_id
        if (keeper.partido_id !== canonical.canonicalName) {
            updates.partido_id = canonical.canonicalName;
        }

        // Set jurisdiction codes
        if (canonical.partyCode && canonical.partyCode !== keeper.partido_code) {
            updates.partido_code = canonical.partyCode;
        }
        if (canonical.delegationCode && canonical.delegationCode !== keeper.delegacion_code) {
            updates.delegacion_code = canonical.delegationCode;
        }

        // Merge data from duplicates into keeper
        for (const dup of duplicates) {
            if (!keeper.nomenclatura && dup.nomenclatura) {
                updates.nomenclatura = dup.nomenclatura;
                keeper.nomenclatura = dup.nomenclatura;
            }
            if (!keeper.transcripcion_literal && dup.transcripcion_literal) {
                updates.transcripcion_literal = dup.transcripcion_literal;
                keeper.transcripcion_literal = dup.transcripcion_literal;
            }
            if (!keeper.titulo_antecedente && dup.titulo_antecedente) {
                updates.titulo_antecedente = dup.titulo_antecedente;
            }
            if (!keeper.valuacion_fiscal && dup.valuacion_fiscal) {
                updates.valuacion_fiscal = dup.valuacion_fiscal;
            }
        }

        // Apply updates to keeper
        if (Object.keys(updates).length > 0) {
            const { error: upErr } = await supabase.from('inmuebles').update(updates).eq('id', keeper.id);
            if (upErr) {
                console.error(`  ⚠ Error updating keeper ${keeper.id}: ${upErr.message}`);
            } else {
                normalizedCount++;
                if (updates.partido_id) {
                    console.log(`  ✓ "${records[0].partido_id}" → "${updates.partido_id}" (partida ${keeper.nro_partida})`);
                }
            }
        }

        // Delete duplicates
        if (duplicates.length > 0) {
            mergedCount++;
            for (const dup of duplicates) {
                // Move FK references
                await supabase
                    .from('escritura_inmueble')
                    .update({ inmueble_id: keeper.id })
                    .eq('inmueble_id', dup.id);

                // Delete duplicate
                const { error: delErr } = await supabase.from('inmuebles').delete().eq('id', dup.id);
                if (delErr) {
                    console.error(`  ⚠ Error deleting ${dup.id}: ${delErr.message}`);
                } else {
                    deletedCount++;
                }
            }
            console.log(`  🔀 Merged ${records.length} → 1: ${key} (kept ${keeper.id.substring(0, 8)})`);
        }
    }

    // Normalize records without partida
    for (const inm of noPartida) {
        const resolved = normalizePartido(inm.partido_id);
        const updates: Record<string, any> = {};
        if (resolved.canonicalName !== inm.partido_id) updates.partido_id = resolved.canonicalName;
        if (resolved.partyCode && resolved.partyCode !== inm.partido_code) updates.partido_code = resolved.partyCode;
        if (resolved.delegationCode && resolved.delegationCode !== inm.delegacion_code) updates.delegacion_code = resolved.delegationCode;

        if (Object.keys(updates).length > 0) {
            await supabase.from('inmuebles').update(updates).eq('id', inm.id);
            normalizedCount++;
        }
    }

    console.log(`\n  Normalized: ${normalizedCount}`);
    console.log(`  Merged groups: ${mergedCount}`);
    console.log(`  Deleted duplicates: ${deletedCount}\n`);

    // ── Summary ──
    console.log('── Summary ──\n');

    const { data: finalData } = await supabase
        .from('inmuebles')
        .select('id, partido_id, partido_code, nomenclatura')
        .order('partido_id', { ascending: true });

    if (finalData) {
        const withNomenclatura = finalData.filter(i => i.nomenclatura).length;
        const withCode = finalData.filter(i => i.partido_code).length;
        const uniquePartidos = [...new Set(finalData.map(i => i.partido_id))];

        console.log(`  Total inmuebles: ${finalData.length}`);
        console.log(`  With nomenclatura: ${withNomenclatura}/${finalData.length}`);
        console.log(`  With partido_code: ${withCode}/${finalData.length}`);
        console.log(`  Unique partidos (${uniquePartidos.length}): ${uniquePartidos.join(', ')}`);

        const noNom = finalData.filter(i => !i.nomenclatura);
        if (noNom.length > 0) {
            console.log(`\n  ⚠ Missing nomenclatura:`);
            noNom.forEach(i => console.log(`    - ${i.partido_id} (${i.id.substring(0, 8)})`));
        }
    }

    console.log('\n══════════════════════════════════════════════════');
    console.log('  DONE');
    console.log('══════════════════════════════════════════════════');
}

main().catch(console.error);
