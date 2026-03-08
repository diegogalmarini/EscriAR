/**
 * JurisdictionResolver para el Worker (Railway).
 *
 * Versión standalone que carga el mismo JSON compartido con la app Next.js.
 * No depende de @/ paths ni de Next.js.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface JurisdictionMatch {
    partyName: string;
    partyCode: string;
    delegationCode: string;
}

interface PartyEntry {
    name: string;
    code: string;
    delegation_code: string;
    aliases: string[];
}

const ACCENT_MAP: Record<string, string> = {
    'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u',
    'Á': 'a', 'É': 'e', 'Í': 'i', 'Ó': 'o', 'Ú': 'u', 'Ü': 'u',
};

function normalizeForLookup(text: string): string {
    return text.trim().toLowerCase().replace(/[áéíóúüÁÉÍÓÚÜ]/g, c => ACCENT_MAP[c] || c);
}

// Cargar JSON compartido (relativo a worker/src/ → ../../src/data/)
let aliasMap: Map<string, PartyEntry> | null = null;

function ensureLoaded(): Map<string, PartyEntry> {
    if (aliasMap) return aliasMap;

    aliasMap = new Map();

    try {
        const jsonPath = path.resolve(__dirname, '..', '..', 'src', 'data', 'pba_2026_jurisdictions.json');
        const raw = fs.readFileSync(jsonPath, 'utf-8');
        const data = JSON.parse(raw);

        for (const party of data.parties || []) {
            for (const alias of party.aliases) {
                aliasMap.set(normalizeForLookup(alias), party);
            }
            aliasMap.set(normalizeForLookup(party.name), party);
        }

        console.log(`[JURISDICTION] Loaded ${data.parties?.length ?? 0} parties from ${data.jurisdiction_id} v${data.version}`);
    } catch (err) {
        console.warn(`[JURISDICTION] Could not load jurisdiction data:`, (err as Error).message);
    }

    return aliasMap;
}

export function resolveJurisdiction(extractedText: string): JurisdictionMatch | null {
    if (!extractedText?.trim()) return null;

    const map = ensureLoaded();
    const normalized = normalizeForLookup(extractedText);

    // Exact match
    const exact = map.get(normalized);
    if (exact) {
        return { partyName: exact.name, partyCode: exact.code, delegationCode: exact.delegation_code };
    }

    // Containment match (longest alias first)
    const sorted = [...map.entries()].sort((a, b) => b[0].length - a[0].length);
    for (const [alias, party] of sorted) {
        if (alias.length >= 4 && normalized.includes(alias)) {
            return { partyName: party.name, partyCode: party.code, delegationCode: party.delegation_code };
        }
    }

    return null;
}
