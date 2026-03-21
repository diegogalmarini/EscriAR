import { resolveModel, extractCounterpartyFromContext, type ModelCandidate } from "../modelResolver";

// ─── Helpers ────────────────────────────────────────────

function makeModel(overrides: Partial<ModelCandidate> & { scope?: string; counterparty?: string }): ModelCandidate {
    const { scope, counterparty, ...rest } = overrides;
    return {
        id: `model-${Math.random().toString(36).slice(2, 8)}`,
        act_type: "hipoteca",
        version: 1,
        is_active: true,
        metadata: {
            model_scope: (scope as any) || "generic_base",
            counterparty_name: counterparty || undefined,
        },
        ...rest,
    };
}

// ─── resolveModel ───────────────────────────────────────

describe("resolveModel", () => {
    test("returns null for empty candidates", () => {
        expect(resolveModel([], { actType: "hipoteca" })).toBeNull();
    });

    test("returns null for all inactive candidates", () => {
        const candidates = [makeModel({ is_active: false })];
        expect(resolveModel(candidates, { actType: "hipoteca" })).toBeNull();
    });

    test("hipoteca privada -> generic_base (no counterparty)", () => {
        const generic = makeModel({ scope: "generic_base", version: 2 });
        const entityBN = makeModel({ scope: "entity_fixed", counterparty: "BANCO DE LA NACION ARGENTINA", version: 1 });

        const result = resolveModel([generic, entityBN], { actType: "hipoteca" });
        expect(result).not.toBeNull();
        expect(result!.model.id).toBe(generic.id);
        expect(result!.scope).toBe("generic_base");
        expect(result!.reason).toBe("Modelo genérico");
        expect(result!.isCounterpartyMatch).toBe(false);
    });

    test("hipoteca Banco Nación -> entity_fixed match", () => {
        const generic = makeModel({ scope: "generic_base", version: 2 });
        const entityBN = makeModel({ scope: "entity_fixed", counterparty: "BANCO DE LA NACION ARGENTINA", version: 1 });

        const result = resolveModel([generic, entityBN], {
            actType: "hipoteca",
            counterpartyName: "BANCO DE LA NACION ARGENTINA",
        });
        expect(result).not.toBeNull();
        expect(result!.model.id).toBe(entityBN.id);
        expect(result!.scope).toBe("entity_fixed");
        expect(result!.isCounterpartyMatch).toBe(true);
        expect(result!.reason).toContain("Fijo Entidad");
    });

    test("fideicomiso with known counterparty -> adaptable_guided match", () => {
        const generic = makeModel({ scope: "generic_base", act_type: "fideicomiso", version: 2 });
        const adaptable = makeModel({ scope: "adaptable_guided", counterparty: "FIDEICOMISO V8", act_type: "fideicomiso", version: 1 });

        const result = resolveModel([generic, adaptable], {
            actType: "fideicomiso",
            counterpartyName: "FIDEICOMISO V8",
        });
        expect(result).not.toBeNull();
        expect(result!.model.id).toBe(adaptable.id);
        expect(result!.scope).toBe("adaptable_guided");
        expect(result!.isCounterpartyMatch).toBe(true);
    });

    test("entity_fixed takes priority over adaptable_guided for same counterparty", () => {
        const generic = makeModel({ scope: "generic_base", version: 3 });
        const adaptable = makeModel({ scope: "adaptable_guided", counterparty: "BANCO GALICIA", version: 2 });
        const entityFixed = makeModel({ scope: "entity_fixed", counterparty: "BANCO GALICIA", version: 1 });

        const result = resolveModel([generic, adaptable, entityFixed], {
            actType: "hipoteca",
            counterpartyName: "BANCO GALICIA",
        });
        expect(result!.model.id).toBe(entityFixed.id);
        expect(result!.scope).toBe("entity_fixed");
    });

    test("unknown counterparty falls back to generic_base", () => {
        const generic = makeModel({ scope: "generic_base", version: 2 });
        const entityBN = makeModel({ scope: "entity_fixed", counterparty: "BANCO DE LA NACION ARGENTINA", version: 1 });

        const result = resolveModel([generic, entityBN], {
            actType: "hipoteca",
            counterpartyName: "BANCO DESCONOCIDO",
        });
        expect(result!.model.id).toBe(generic.id);
        expect(result!.scope).toBe("generic_base");
        expect(result!.isCounterpartyMatch).toBe(false);
    });

    test("no metadata (old record) -> fallback to generic_base", () => {
        const oldModel: ModelCandidate = {
            id: "old-model",
            act_type: "compraventa",
            version: 1,
            is_active: true,
            metadata: null,
        };

        const result = resolveModel([oldModel], { actType: "compraventa" });
        expect(result).not.toBeNull();
        expect(result!.model.id).toBe("old-model");
        expect(result!.scope).toBe("generic_base");
    });

    test("old record without model_scope -> treated as generic_base", () => {
        const oldModel: ModelCandidate = {
            id: "old-model-2",
            act_type: "donacion",
            version: 1,
            is_active: true,
            metadata: { template_name: "donacion_template" },
        };

        const result = resolveModel([oldModel], { actType: "donacion" });
        expect(result!.scope).toBe("generic_base");
    });

    test("counterparty matching is case-insensitive", () => {
        const entityFixed = makeModel({ scope: "entity_fixed", counterparty: "Banco de la Nación Argentina", version: 1 });
        const generic = makeModel({ scope: "generic_base", version: 2 });

        const result = resolveModel([generic, entityFixed], {
            actType: "hipoteca",
            counterpartyName: "BANCO DE LA NACIÓN ARGENTINA",
        });
        // Should match despite case difference
        expect(result!.model.id).toBe(entityFixed.id);
        expect(result!.isCounterpartyMatch).toBe(true);
    });

    test("latest version wins when multiple entity_fixed for same counterparty", () => {
        const v1 = makeModel({ scope: "entity_fixed", counterparty: "BANCO GALICIA", version: 1 });
        const v2 = makeModel({ scope: "entity_fixed", counterparty: "BANCO GALICIA", version: 2 });

        const result = resolveModel([v1, v2], {
            actType: "hipoteca",
            counterpartyName: "BANCO GALICIA",
        });
        expect(result!.model.id).toBe(v2.id);
    });
});

// ─── extractCounterpartyFromContext ─────────────────────

describe("extractCounterpartyFromContext", () => {
    test("extracts JURIDICA vendedor", () => {
        const context = {
            vendedores: [
                { nombre_completo: "BANCO DE LA NACION ARGENTINA", tipo_persona: "JURIDICA" },
            ],
            compradores: [
                { nombre_completo: "PEREZ, Juan", tipo_persona: "FISICA" },
            ],
        };
        expect(extractCounterpartyFromContext(context)).toBe("BANCO DE LA NACION ARGENTINA");
    });

    test("extracts FIDEICOMISO vendedor", () => {
        const context = {
            vendedores: [
                { nombre_completo: "FIDEICOMISO LA LINDA", tipo_persona: "FIDEICOMISO" },
            ],
        };
        expect(extractCounterpartyFromContext(context)).toBe("FIDEICOMISO LA LINDA");
    });

    test("extracts JURIDICA comprador when no JURIDICA vendedor", () => {
        const context = {
            vendedores: [
                { nombre_completo: "PEREZ, Juan", tipo_persona: "FISICA" },
            ],
            compradores: [
                { nombre_completo: "IACA LABORATORIOS S.A.", tipo_persona: "JURIDICA" },
            ],
        };
        expect(extractCounterpartyFromContext(context)).toBe("IACA LABORATORIOS S.A.");
    });

    test("returns null when all parties are FISICA", () => {
        const context = {
            vendedores: [
                { nombre_completo: "GARCIA, Maria", tipo_persona: "FISICA" },
            ],
            compradores: [
                { nombre_completo: "LOPEZ, Carlos", tipo_persona: "FISICA" },
            ],
        };
        expect(extractCounterpartyFromContext(context)).toBeNull();
    });

    test("returns null for empty context", () => {
        expect(extractCounterpartyFromContext({})).toBeNull();
    });

    test("returns null when vendedores/compradores are undefined", () => {
        const context = { escritura: { numero: 1 } };
        expect(extractCounterpartyFromContext(context)).toBeNull();
    });
});
