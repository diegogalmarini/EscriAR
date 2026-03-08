/**
 * Deterministic Tax Calculator for Argentine Notary Operations (PBA focus)
 * Based on notary-tax-calculator skill.
 *
 * Todos los valores fiscales se leen de fiscal_config_2026.json
 * (fuente única de verdad para tasas, topes y aportes).
 */

import fiscalConfig from '@/data/fiscal_config_2026.json';

export interface TaxCalculationInput {
    price: number;
    currency: 'USD' | 'ARS' | 'UVA';
    exchangeRate: number; // For USD this is the dollar rate, for UVA it's the UVA rate
    acquisitionDate: string; // YYYY-MM-DD
    isUniqueHome: boolean;
    fiscalValuation: number;
    sellosExemptionThreshold?: number; // Tope Ley Impositiva
}

export interface TaxCalculationResult {
    baseCalculoArs: number;
    detail: {
        sellosPba: number;
        itiAfip: number;
        honorarios: number;
        iva21: number;
        aportesNotariales: number;
    };
    totalExpensesArs: number;
    totalExpensesUsd?: number;
    totalExpensesUva?: number;
}

export function calculateNotaryExpenses(input: TaxCalculationInput): TaxCalculationResult {
    const {
        price,
        currency,
        exchangeRate,
        acquisitionDate,
        isUniqueHome,
        fiscalValuation,
        sellosExemptionThreshold = fiscalConfig.sellos.tope_default
    } = input;

    // Calculo de Base Imponible en ARS
    let priceArs = price;
    if (currency === 'USD') {
        priceArs = price * exchangeRate;
    } else if (currency === 'UVA') {
        priceArs = price * exchangeRate; // Aquí exchangeRate es el valor de la UVA
    }

    const baseSellos = Math.max(priceArs, fiscalValuation);

    // 1. Impuesto de Sellos (PBA)
    let sellosPba = 0;
    const tasaSellos = fiscalConfig.sellos.rate;

    if (isUniqueHome) {
        if (baseSellos > sellosExemptionThreshold) {
            sellosPba = (baseSellos - sellosExemptionThreshold) * tasaSellos;
        } else {
            sellosPba = 0;
        }
    } else {
        sellosPba = baseSellos * tasaSellos;
    }

    // 2. ITI - Aplica si se adquirió antes de 2018
    let itiAfip = 0;
    const isPre2018 = new Date(acquisitionDate) < new Date(fiscalConfig.iti.cutoff_date);
    if (isPre2018) {
        itiAfip = priceArs * fiscalConfig.iti.rate;
    }

    // 3. Honorarios
    const honorarios = priceArs * fiscalConfig.honorarios.suggested_rate;
    const iva21 = honorarios * fiscalConfig.iva.rate;

    // 4. Aportes
    const aportesNotariales = honorarios * fiscalConfig.aportes.sobre_honorarios;

    const totalArs = sellosPba + itiAfip + honorarios + iva21 + aportesNotariales;

    return {
        baseCalculoArs: baseSellos,
        detail: {
            sellosPba: Math.round(sellosPba * 100) / 100,
            itiAfip: Math.round(itiAfip * 100) / 100,
            honorarios: Math.round(honorarios * 100) / 100,
            iva21: Math.round(iva21 * 100) / 100,
            aportesNotariales: Math.round(aportesNotariales * 100) / 100
        },
        totalExpensesArs: Math.round(totalArs * 100) / 100,
        totalExpensesUsd: currency === 'USD' ? Math.round((totalArs / exchangeRate) * 100) / 100 : undefined,
        totalExpensesUva: currency === 'UVA' ? Math.round((totalArs / exchangeRate) * 100) / 100 : undefined
    };
}
