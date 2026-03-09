/**
 * JurisdictionResolver para el Worker (Railway).
 *
 * Intenta resolver desde la DB (tabla jurisdicciones) y cae a JSON estático como fallback.
 * No depende de @/ paths ni de Next.js.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

// ─── In-memory cache ──────────────────────────────────────

let aliasMap: Map<string, PartyEntry> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function buildMapFromEntries(entries: PartyEntry[]): Map<string, PartyEntry> {
    const map = new Map<string, PartyEntry>();
    for (const party of entries) {
        map.set(normalizeForLookup(party.name), party);
        for (const alias of party.aliases) {
            map.set(normalizeForLookup(alias), party);
        }
    }
    return map;
}

// ─── DB loader (primary) ──────────────────────────────────

function getSupabaseClient(): SupabaseClient | null {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

async function loadFromDb(): Promise<Map<string, PartyEntry> | null> {
    const sb = getSupabaseClient();
    if (!sb) return null;

    try {
        const { data, error } = await sb
            .from('jurisdicciones')
            .select('party_name, party_code, delegation_code, aliases')
            .eq('active', true);

        if (error || !data || data.length === 0) return null;

        const entries: PartyEntry[] = data.map((row: any) => ({
            name: row.party_name,
            code: row.party_code,
            delegation_code: row.delegation_code,
            aliases: row.aliases ?? [],
        }));

        console.log(`[JURISDICTION] Loaded ${entries.length} active parties from DB`);
        return buildMapFromEntries(entries);
    } catch (err) {
        console.warn(`[JURISDICTION] DB load failed:`, (err as Error).message);
        return null;
    }
}

// ─── JSON fallback loader ─────────────────────────────────

function loadFromJson(): Map<string, PartyEntry> {
    const map = new Map<string, PartyEntry>();
    try {
        const jsonPath = path.resolve(__dirname, '..', '..', 'src', 'data', 'pba_2026_jurisdictions.json');
        const raw = fs.readFileSync(jsonPath, 'utf-8');
        const data = JSON.parse(raw);

        const entries: PartyEntry[] = (data.parties || []).map((p: any) => ({
            name: p.name,
            code: p.code,
            delegation_code: p.delegation_code,
            aliases: p.aliases,
        }));

        console.log(`[JURISDICTION] Fallback: loaded ${entries.length} parties from JSON (${data.jurisdiction_id} v${data.version})`);
        return buildMapFromEntries(entries);
    } catch (err) {
        console.warn(`[JURISDICTION] JSON fallback also failed:`, (err as Error).message);
    }
    return map;
}

// ─── Ensure loaded (with TTL) ─────────────────────────────

async function ensureLoaded(): Promise<Map<string, PartyEntry>> {
    const now = Date.now();
    if (aliasMap && (now - cacheTimestamp) < CACHE_TTL_MS) return aliasMap;

    // Try DB first, fall back to JSON
    const dbMap = await loadFromDb();
    if (dbMap && dbMap.size > 0) {
        aliasMap = dbMap;
    } else {
        aliasMap = loadFromJson();
    }
    cacheTimestamp = now;
    return aliasMap;
}

// ─── Public API ───────────────────────────────────────────

export async function resolveJurisdiction(extractedText: string): Promise<JurisdictionMatch | null> {
    if (!extractedText?.trim()) return null;

    const map = await ensureLoaded();
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
