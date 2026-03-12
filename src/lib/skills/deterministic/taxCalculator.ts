/**
 * Deterministic Tax Calculator for Argentine Notary Operations (PBA focus)
 * Based on notary-tax-calculator skill.
 *
 * Delegated to PresupuestoEngine as single source of truth.
 * This wrapper preserves the original interface for SkillExecutor compatibility.
 */

import { calcularPresupuesto, type PresupuestoInput } from '@/lib/services/PresupuestoEngine';
import fiscalConfig from '@/data/fiscal_config_2026.json';

export interface TaxCalculationInput {
    price: number;
    currency: 'USD' | 'ARS' | 'UVA';
    exchangeRate: number;
    acquisitionDate: string;
    isUniqueHome: boolean;
    fiscalValuation: number;
    sellosExemptionThreshold?: number;
}

export interface TaxCalculationResult {
    baseCalculoArs: number;
    detail: {
        sellosPba: number;
        gananciasGlobalAfip: number;
        honorarios: number;
        iva21: number;
        aportesNotariales: number;
    };
    totalExpensesArs: number;
    totalExpensesUsd?: number;
    totalExpensesUva?: number;
}

export function calculateNotaryExpenses(input: TaxCalculationInput): TaxCalculationResult {
    const exchangeRate = input.currency === 'ARS' ? 1 : input.exchangeRate;
    const priceArs = input.price * exchangeRate;

    const engineInput: PresupuestoInput = {
        tipo_acto: "COMPRAVENTA",
        monto_operacion: input.price,
        moneda: input.currency === 'UVA' ? 'ARS' : (input.currency as 'ARS' | 'USD'),
        cotizacion_usd: input.currency === 'USD' ? input.exchangeRate : undefined,
        valuacion_fiscal: input.fiscalValuation,
        tipo_inmueble: "EDIFICADO",
        es_vivienda_unica: input.isUniqueHome,
        fecha_adquisicion_vendedor: input.acquisitionDate,
        honorarios_pct: fiscalConfig.honorarios.suggested_rate,
    };

    const result = calcularPresupuesto(engineInput);

    // Map engine output back to legacy interface
    const byRubro = (rubro: string) =>
        result.lineas.filter(l => l.rubro === rubro).reduce((s, l) => s + l.monto, 0);

    const sellosPba = byRubro("SELLOS_PBA");
    const gananciasGlobalAfip = byRubro("GANANCIAS_GLOBAL");
    const honorarios = byRubro("HONORARIOS");
    const iva21 = byRubro("IVA_HONORARIOS");
    const aportesNotariales = byRubro("APORTE_CAJA") + byRubro("APORTE_COLEGIO");

    const totalArs = result.totales.total;
    const baseSellos = Math.max(priceArs, input.fiscalValuation);

    return {
        baseCalculoArs: baseSellos,
        detail: {
            sellosPba: Math.round(sellosPba * 100) / 100,
            gananciasGlobalAfip: Math.round(gananciasGlobalAfip * 100) / 100,
            honorarios: Math.round(honorarios * 100) / 100,
            iva21: Math.round(iva21 * 100) / 100,
            aportesNotariales: Math.round(aportesNotariales * 100) / 100,
        },
        totalExpensesArs: Math.round(totalArs * 100) / 100,
        totalExpensesUsd: input.currency === 'USD' ? Math.round((totalArs / exchangeRate) * 100) / 100 : undefined,
        totalExpensesUva: input.currency === 'UVA' ? Math.round((totalArs / exchangeRate) * 100) / 100 : undefined,
    };
}
