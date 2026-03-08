/**
 * JurisdictionResolver - Motor determinístico de resolución jurisdiccional
 *
 * Resuelve nombres de partidos/departamentos a códigos numéricos oficiales
 * para RPI, ARBA, Catastro y CESBA.
 *
 * REGLA DE ORO: La IA NUNCA calcula códigos. Solo extrae texto.
 * Este servicio resuelve determinísticamente a partir de datos verificados.
 *
 * Patrón: igual a TaxonomyService — JSON estático + singleton module-level.
 */

import jurisdictionData from '@/data/pba_2026_jurisdictions.json';

// --- Types ---

export interface JurisdictionMatch {
    partyName: string;       // "Monte Hermoso" (canónico)
    partyCode: string;       // "126" (código RPI/ARBA del partido)
    delegationCode: string;  // "007" (código delegación CESBA/Colegio)
    jurisdictionId: string;  // "PBA"
}

interface PartyEntry {
    name: string;
    code: string;
    delegation_code: string;
    aliases: string[];
}

interface JurisdictionData {
    jurisdiction_id: string;
    version: string;
    parties: PartyEntry[];
}

// --- Normalización interna (alineada con normalizePartido de normalization.ts) ---

const ACCENT_MAP: Record<string, string> = {
    'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u', 'ñ': 'ñ',
    'Á': 'a', 'É': 'e', 'Í': 'i', 'Ó': 'o', 'Ú': 'u', 'Ü': 'u', 'Ñ': 'ñ',
};

function normalizeForLookup(text: string): string {
    return text
        .trim()
        .toLowerCase()
        .replace(/[áéíóúüÁÉÍÓÚÜñÑ]/g, c => ACCENT_MAP[c] || c);
}

// --- Service ---

export class JurisdictionResolver {
    private aliasMap: Map<string, PartyEntry> = new Map();
    private codeMap: Map<string, PartyEntry> = new Map();
    private data: JurisdictionData;

    constructor() {
        this.data = jurisdictionData as JurisdictionData;
        this.buildIndexes();
    }

    private buildIndexes(): void {
        for (const party of this.data.parties) {
            // Index by code
            this.codeMap.set(party.code, party);

            // Index by all aliases (ya normalizados en el JSON)
            for (const alias of party.aliases) {
                this.aliasMap.set(normalizeForLookup(alias), party);
            }

            // Index por nombre canónico también
            this.aliasMap.set(normalizeForLookup(party.name), party);
        }
    }

    /**
     * Resuelve texto extraído por la IA a códigos jurisdiccionales.
     *
     * Flujo:
     * 1. Normaliza input (lowercase, strip accents)
     * 2. Exact match contra aliases
     * 3. Si no hay exact, busca containment (el input contiene un alias conocido)
     * 4. Retorna null si no hay match (la IA inventó algo o es provincia no soportada)
     */
    resolve(extractedText: string): JurisdictionMatch | null {
        if (!extractedText?.trim()) return null;

        const normalized = normalizeForLookup(extractedText);

        // 1. Exact match
        const exact = this.aliasMap.get(normalized);
        if (exact) return this.toMatch(exact);

        // 2. Containment: el texto extraído contiene un alias conocido
        //    Ej: "Partido de Monte Hermoso" contiene "monte hermoso"
        //    Ordenamos por longitud descendente para matchear lo más específico primero
        const sortedAliases = [...this.aliasMap.entries()]
            .sort((a, b) => b[0].length - a[0].length);

        for (const [alias, party] of sortedAliases) {
            if (alias.length >= 4 && normalized.includes(alias)) {
                return this.toMatch(party);
            }
        }

        // 3. No match
        return null;
    }

    /**
     * Resuelve por código numérico (lookup inverso).
     * Útil para mostrar nombre a partir de código en minutas existentes.
     */
    resolveByCode(code: string): JurisdictionMatch | null {
        const party = this.codeMap.get(code);
        return party ? this.toMatch(party) : null;
    }

    /**
     * Lista todos los partidos disponibles (para autocompletar UI).
     */
    getAllParties(): JurisdictionMatch[] {
        return this.data.parties.map(p => this.toMatch(p));
    }

    /**
     * Retorna la versión activa del dataset.
     */
    getVersion(): string {
        return this.data.version;
    }

    /**
     * Retorna el ID de jurisdicción.
     */
    getJurisdictionId(): string {
        return this.data.jurisdiction_id;
    }

    private toMatch(party: PartyEntry): JurisdictionMatch {
        return {
            partyName: party.name,
            partyCode: party.code,
            delegationCode: party.delegation_code,
            jurisdictionId: this.data.jurisdiction_id,
        };
    }
}

// TODO [ET12b]: Cuando el admin UI esté listo, reemplazar el import estático
// por carga desde Supabase con TTL cache (60s). Verificar que la provincia
// esté activa según configuración del usuario en su Panel de Administración.
// La interfaz pública (resolve, resolveByCode) no cambia.

// Export singleton instance (module-level cache, igual que TaxonomyService)
export const jurisdictionResolver = new JurisdictionResolver();
