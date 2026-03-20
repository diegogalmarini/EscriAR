/**
 * Recipe-based presupuesto engine.
 *
 * Each act type (compraventa, hipoteca, etc.) defines a canonical recipe
 * with exactly the rubros the escribano expects — no duplicates, no auto-injection.
 *
 * All formulas are evaluated client-side. No server call needed.
 */

// ─── Types ──────────────────────────────────────────────

export type IvaClass = "exento" | "gravado";

export interface RecipeRubro {
  id: string;
  label: string;
  iva_class: IvaClass;
  /** Formula function receiving resolved inputs & constants */
  calc: (ctx: RecipeContext) => number;
}

export interface RecipeConstants {
  global: Record<string, number>;
  by_jurisdiction: {
    PBA: Record<string, number>;
    CABA: Record<string, number>;
  };
}

export interface Recipe {
  recipe_id: string;
  act_type: string;
  act_code: string;
  version: string;
  constants: RecipeConstants;
  rubros: RecipeRubro[];
  /** Which rubro IDs contribute to vendedor (each at 50%) */
  vendedor_rubros: string[];
}

export interface RecipeInputs {
  jurisdiction: "PBA" | "CABA";
  escritura_ars: number;
  precio_real_usd: number;
  cotizacion_bna: number;
  cant_inmuebles: number;
  cant_certificados_rpi: number;
  cant_fojas: number;
}

/** Context passed to each rubro calc function */
export interface RecipeContext extends RecipeInputs {
  /** Resolved constants (global merged with jurisdiction) */
  C: Record<string, number>;
}

// ─── Computed result ────────────────────────────────────

export interface RecipeRubroResult {
  id: string;
  label: string;
  iva_class: IvaClass;
  monto: number;
}

export interface RecipeResult {
  rubros: RecipeRubroResult[];
  subtotal_exento: number;
  subtotal_gravado: number;
  iva: number;
  total: number;
  discriminacion: {
    vendedor: { items: { concepto: string; monto: number }[]; total: number };
    comprador: { items: { concepto: string; monto: number }[]; total: number };
  };
}

// ─── Compraventa Recipe v1.1 ────────────────────────────

export const RECIPE_COMPRAVENTA: Recipe = {
  recipe_id: "compraventa_v1_1_escribano_2026",
  act_type: "compraventa",
  act_code: "100-00",
  version: "1.1",
  constants: {
    global: {
      HONORARIOS_RATE: 0.02,
      HONORARIOS_MIN: 891000,
      DILI_ESTUDIO_BASE: 2079000,
      DILI_ESTUDIO_RATE: 0.002,
      DILI_ESTUDIO_SUM: 89100,
      DILIGENCIAMIENTOS_MAX: 1234926,
      AGENTE_RETENCION_MIN: 334125,
      MATRIZ_TESTIMONIOS_UNIT: 10962,
      MATRICULA_ROGATORIA_UNIT: 125000,
      IVA_RATE: 0.21,
    },
    by_jurisdiction: {
      PBA: {
        SELLOS_RATE: 0.02,
        TASA_RPI_RATE: 0.002,
        APORTE_NOTARIAL_RATE: 0.008,
        CERT_ADMIN_UNIT: 90000,
        CERT_RPI_UNIT: 70800,
      },
      CABA: {
        SELLOS_RATE: 0.027,
        TASA_RPI_RATE: 0.002,
        APORTE_NOTARIAL_RATE: 0.008,
        CERT_ADMIN_UNIT: 90000,
        CERT_RPI_UNIT: 70800,
      },
    },
  },
  rubros: [
    {
      id: "ley_sellos",
      label: "Ley de Sellos",
      iva_class: "exento",
      calc: (ctx) => ctx.escritura_ars * ctx.C.SELLOS_RATE,
    },
    {
      id: "sellados_cert_admin",
      label: "Sellados Certificados Administrativos",
      iva_class: "exento",
      calc: (ctx) => ctx.cant_inmuebles * ctx.C.CERT_ADMIN_UNIT,
    },
    {
      id: "sellados_cert_rpi",
      label: "Sellados Certificados Registro de la Propiedad",
      iva_class: "exento",
      calc: (ctx) => ctx.cant_certificados_rpi * ctx.C.CERT_RPI_UNIT,
    },
    {
      id: "tasa_inscripcion_rpi",
      label: "Tasa de Inscripción Registro de la Propiedad",
      iva_class: "exento",
      calc: (ctx) => ctx.escritura_ars * ctx.C.TASA_RPI_RATE,
    },
    {
      id: "aporte_notarial",
      label: "Aporte Notarial",
      iva_class: "exento",
      calc: (ctx) => ctx.escritura_ars * ctx.C.APORTE_NOTARIAL_RATE,
    },
    {
      id: "sellados_matriz_testimonios",
      label: "Sellados de Escritura Matriz y Testimonios",
      iva_class: "gravado",
      calc: (ctx) => ctx.cant_fojas * ctx.C.MATRIZ_TESTIMONIOS_UNIT,
    },
    {
      id: "confeccion_matricula_rogatoria",
      label: "Confección Matrícula y Rogatoria",
      iva_class: "gravado",
      calc: (ctx) => ctx.cant_inmuebles * ctx.C.MATRICULA_ROGATORIA_UNIT,
    },
    {
      id: "diligenciamientos",
      label: "Diligenciamientos",
      iva_class: "gravado",
      calc: (ctx) => {
        const base =
          (ctx.escritura_ars - ctx.C.DILI_ESTUDIO_BASE) * ctx.C.DILI_ESTUDIO_RATE +
          ctx.C.DILI_ESTUDIO_SUM;
        return Math.max(0, Math.min(base, ctx.C.DILIGENCIAMIENTOS_MAX));
      },
    },
    {
      id: "estudio_titulos",
      label: "Estudio de Títulos",
      iva_class: "gravado",
      calc: (ctx) => {
        const base =
          (ctx.escritura_ars - ctx.C.DILI_ESTUDIO_BASE) * ctx.C.DILI_ESTUDIO_RATE +
          ctx.C.DILI_ESTUDIO_SUM;
        return Math.max(0, base);
      },
    },
    {
      id: "agente_retencion",
      label: "Funciones de Agente de Retención",
      iva_class: "gravado",
      calc: (ctx) => ctx.C.AGENTE_RETENCION_MIN,
    },
    {
      id: "honorarios",
      label: "Honorarios",
      iva_class: "gravado",
      calc: (ctx) => {
        const precioRealArs = ctx.precio_real_usd * ctx.cotizacion_bna;
        return Math.max(precioRealArs * ctx.C.HONORARIOS_RATE, ctx.C.HONORARIOS_MIN);
      },
    },
  ],
  vendedor_rubros: ["ley_sellos", "aporte_notarial"],
};

// ─── Recipe Registry ────────────────────────────────────

const RECIPES: Record<string, Recipe> = {
  compraventa: RECIPE_COMPRAVENTA,
};

/** Returns a recipe for the given act type, or null if none defined */
export function getRecipe(actType: string): Recipe | null {
  const normalized = actType.toLowerCase().replace(/[\s_-]/g, "");
  for (const [key, recipe] of Object.entries(RECIPES)) {
    if (normalized.includes(key)) return recipe;
  }
  return null;
}

// ─── Evaluator ──────────────────────────────────────────

function resolveConstants(recipe: Recipe, jurisdiction: "PBA" | "CABA"): Record<string, number> {
  return {
    ...recipe.constants.global,
    ...recipe.constants.by_jurisdiction[jurisdiction],
  };
}

/**
 * Evaluate a recipe with the given inputs.
 * Returns all rubros calculated, IVA breakdown, and distribution.
 *
 * Rubro amounts can be overridden via the `overrides` map (id → fixed amount).
 */
export function evaluateRecipe(
  recipe: Recipe,
  inputs: RecipeInputs,
  overrides?: Map<string, number>
): RecipeResult {
  const C = resolveConstants(recipe, inputs.jurisdiction);
  const ctx: RecipeContext = { ...inputs, C };

  // Calculate each rubro
  const rubros: RecipeRubroResult[] = recipe.rubros.map((r) => {
    const override = overrides?.get(r.id);
    const monto = override !== undefined ? override : Math.round(r.calc(ctx));
    return { id: r.id, label: r.label, iva_class: r.iva_class, monto };
  });

  // IVA totals
  const subtotal_exento = rubros
    .filter((r) => r.iva_class === "exento")
    .reduce((s, r) => s + r.monto, 0);
  const subtotal_gravado = rubros
    .filter((r) => r.iva_class === "gravado")
    .reduce((s, r) => s + r.monto, 0);
  const iva = Math.round(subtotal_gravado * C.IVA_RATE);
  const total = subtotal_exento + subtotal_gravado + iva;

  // Distribution: vendedor gets 50% of specified rubros
  const vendedorSet = new Set(recipe.vendedor_rubros);
  const vendedorItems: { concepto: string; monto: number }[] = [];
  const compradorItems: { concepto: string; monto: number }[] = [];

  for (const r of rubros) {
    if (vendedorSet.has(r.id)) {
      const half = Math.round(r.monto * 0.5);
      vendedorItems.push({ concepto: `${r.label} (50%)`, monto: half });
      compradorItems.push({ concepto: `${r.label} (50%)`, monto: half });
    } else {
      compradorItems.push({ concepto: r.label, monto: r.monto });
    }
  }
  // Add IVA to comprador
  compradorItems.push({ concepto: "IVA 21%", monto: iva });

  const vendedorTotal = vendedorItems.reduce((s, i) => s + i.monto, 0);
  const compradorTotal = total - vendedorTotal;

  return {
    rubros,
    subtotal_exento,
    subtotal_gravado,
    iva,
    total,
    discriminacion: {
      vendedor: { items: vendedorItems, total: vendedorTotal },
      comprador: { items: compradorItems, total: compradorTotal },
    },
  };
}
