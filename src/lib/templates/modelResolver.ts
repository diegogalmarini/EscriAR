/**
 * Model Resolver — selects the best template for a given operation context.
 *
 * Priority:
 *   1. entity_fixed   with exact counterparty_name match
 *   2. adaptable_guided with exact counterparty_name match
 *   3. generic_base    (fallback)
 *
 * Backward compatible: records without metadata.model_scope default to generic_base.
 */

// ─── Types ──────────────────────────────────────────────

export type ModelScope = "generic_base" | "entity_fixed" | "adaptable_guided";

export interface ModelCandidate {
    id: string;
    act_type: string;
    version: number;
    is_active: boolean;
    metadata: {
        model_scope?: ModelScope;
        base_act_type?: string;
        counterparty_name?: string;
        variant_key?: string;
        requires_verbatim?: boolean;
        [key: string]: unknown;
    } | null;
}

export interface ResolverInput {
    actType: string;
    counterpartyName?: string | null;
}

export interface ResolverResult {
    model: ModelCandidate;
    reason: string;
    /** Was a counterparty-specific match found? */
    isCounterpartyMatch: boolean;
    /** The resolved scope of the selected model */
    scope: ModelScope;
}

// ─── Helpers ────────────────────────────────────────────

function getScope(m: ModelCandidate): ModelScope {
    return m.metadata?.model_scope || "generic_base";
}

function getCounterparty(m: ModelCandidate): string | null {
    return m.metadata?.counterparty_name || null;
}

function getBaseActType(m: ModelCandidate): string {
    return m.metadata?.base_act_type || m.act_type;
}

function normalizeCounterparty(name: string): string {
    return name
        .toLowerCase()
        .replace(/[""'']/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function counterpartyMatches(modelCp: string | null, inputCp: string | null): boolean {
    if (!modelCp || !inputCp) return false;
    return normalizeCounterparty(modelCp) === normalizeCounterparty(inputCp);
}

// ─── Resolver ───────────────────────────────────────────

/**
 * Resolves the best model from a list of candidates.
 *
 * @param candidates - All active models for the given act_type (pre-filtered)
 * @param input - The operation context (actType + optional counterpartyName)
 * @returns The best match with reason, or null if no candidates
 */
export function resolveModel(
    candidates: ModelCandidate[],
    input: ResolverInput
): ResolverResult | null {
    if (candidates.length === 0) return null;

    // Only active candidates
    const active = candidates.filter((c) => c.is_active);
    if (active.length === 0) return null;

    const cp = input.counterpartyName || null;

    // 1. entity_fixed with exact counterparty match
    if (cp) {
        const entityFixed = active
            .filter((m) => getScope(m) === "entity_fixed" && counterpartyMatches(getCounterparty(m), cp))
            .sort((a, b) => b.version - a.version);

        if (entityFixed.length > 0) {
            return {
                model: entityFixed[0],
                reason: `Fijo Entidad: ${getCounterparty(entityFixed[0])}`,
                isCounterpartyMatch: true,
                scope: "entity_fixed",
            };
        }

        // 2. adaptable_guided with exact counterparty match
        const adaptable = active
            .filter((m) => getScope(m) === "adaptable_guided" && counterpartyMatches(getCounterparty(m), cp))
            .sort((a, b) => b.version - a.version);

        if (adaptable.length > 0) {
            return {
                model: adaptable[0],
                reason: `Adaptable: ${getCounterparty(adaptable[0])}`,
                isCounterpartyMatch: true,
                scope: "adaptable_guided",
            };
        }
    }

    // 3. generic_base fallback
    const generic = active
        .filter((m) => getScope(m) === "generic_base" || !m.metadata?.model_scope)
        .sort((a, b) => b.version - a.version);

    if (generic.length > 0) {
        return {
            model: generic[0],
            reason: "Modelo genérico",
            isCounterpartyMatch: false,
            scope: "generic_base",
        };
    }

    // 4. Absolute fallback: any active model (latest version)
    const sorted = [...active].sort((a, b) => b.version - a.version);
    return {
        model: sorted[0],
        reason: "Único modelo disponible",
        isCounterpartyMatch: false,
        scope: getScope(sorted[0]),
    };
}

// ─── Counterparty Extractor ─────────────────────────────

/**
 * Extracts a potential counterparty name from carpeta context.
 * Checks vendedores for known entities (banks, companies, fideicomisos).
 */
export function extractCounterpartyFromContext(context: Record<string, unknown>): string | null {
    // Check vendedores first (banks, companies are usually vendedor/acreedor in hipotecas)
    const vendedores = context.vendedores as Array<{ nombre_completo?: string; tipo_persona?: string }> | undefined;
    if (vendedores) {
        for (const v of vendedores) {
            if (v.tipo_persona === "JURIDICA" || v.tipo_persona === "FIDEICOMISO") {
                return v.nombre_completo || null;
            }
        }
    }

    // Check compradores too (for acts like donación where entity is recipient)
    const compradores = context.compradores as Array<{ nombre_completo?: string; tipo_persona?: string }> | undefined;
    if (compradores) {
        for (const c of compradores) {
            if (c.tipo_persona === "JURIDICA" || c.tipo_persona === "FIDEICOMISO") {
                return c.nombre_completo || null;
            }
        }
    }

    return null;
}
