/**
 * TaxonomyService - Servicio de búsqueda de códigos de actos notariales
 * 
 * Consulta la taxonomía de actos CESBA 2026 para obtener códigos y tasas.
 */

import actsData from '@/data/acts_taxonomy_2026.json';

// Types
export interface ActIntent {
    operation_type:
    | "COMPRAVENTA"
    | "HIPOTECA"
    | "DONACION"
    | "CESION"
    | "PODER"
    | "ACTA"
    | "DIVISION_CONDOMINIO"
    | "AFECTACION_BIEN_FAMILIA"
    | "USUFRUCTO"
    | "FIDEICOMISO"
    | "CONSTITUCION_SOCIEDAD"
    | "CANCELACION_HIPOTECA"
    | "OTRO";

    property_type?: "VIVIENDA" | "TERRENO" | "COMERCIAL" | "RURAL" | "PH";
    is_family_home: boolean;
    transaction_amount?: number;

    exemption_flags?: {
        seller_exempt_sellos?: boolean;
        buyer_exempt_sellos?: boolean;
        seller_exempt_aportes?: boolean;
        buyer_exempt_aportes?: boolean;
    };

    special_flags?: {
        is_nuda_propiedad?: boolean;
        is_plan_social_vivienda?: boolean;
        is_regularizacion_dominial?: boolean;
    };
}

export interface ActData {
    code: string;
    description: string;
    category: "REGISTRABLE" | "NON_REGISTRABLE";
    tax_variables: {
        stamp_duty_rate: number;
        min_fee_ars: number;
        fees_extracted: string[];
    };
    flags: string[];
    suspended_rate_2026: boolean;
}

// Operation type to base code mapping
const OPERATION_BASE_CODES: Record<string, string> = {
    "COMPRAVENTA": "100",
    "COMPRAVENTA_NUDA": "103",
    "HIPOTECA": "200",
    "CANCELACION_HIPOTECA": "311",
    "DONACION": "300",
    "CESION": "400",
    "PODER": "500",
    "ACTA": "600",
    "DIVISION_CONDOMINIO": "700",
    "AFECTACION_BIEN_FAMILIA": "800",
    "USUFRUCTO": "150",
    "FIDEICOMISO": "900",
};

// Subcode logic based on exemptions
function determineSubcode(intent: ActIntent): string {
    const { exemption_flags, is_family_home, special_flags } = intent;

    // Vivienda única - exención total
    if (is_family_home) {
        return "-51";
    }

    // Plan social de vivienda
    if (special_flags?.is_plan_social_vivienda) {
        return "-24";
    }

    if (!exemption_flags) {
        return "-00"; // Default: ambas partes pagan todo
    }

    const { seller_exempt_sellos, buyer_exempt_sellos, seller_exempt_aportes, buyer_exempt_aportes } = exemption_flags;
    const one_part_exempt_sellos = (seller_exempt_sellos && !buyer_exempt_sellos) || (!seller_exempt_sellos && buyer_exempt_sellos);
    const both_exempt_sellos = seller_exempt_sellos && buyer_exempt_sellos;
    const one_part_exempt_aportes = (seller_exempt_aportes && !buyer_exempt_aportes) || (!seller_exempt_aportes && buyer_exempt_aportes);
    const both_exempt_aportes = seller_exempt_aportes && buyer_exempt_aportes;

    // Determine subcode
    if (both_exempt_sellos && both_exempt_aportes) return "-22";
    if (both_exempt_sellos && one_part_exempt_aportes) return "-21";
    if (both_exempt_sellos) return "-20";
    if (one_part_exempt_sellos && one_part_exempt_aportes) return "-11";
    if (one_part_exempt_sellos) return "-10";
    if (one_part_exempt_aportes) return "-01";

    return "-00";
}

export class TaxonomyService {
    private acts: Record<string, any>;

    constructor() {
        this.acts = actsData as Record<string, any>;
    }

    /**
     * Get act details by exact code
     */
    getActByCode(code: string): ActData | null {
        const act = this.acts[code];
        if (!act) return null;

        return {
            code,
            description: act.description,
            category: act.category,
            tax_variables: act.tax_variables,
            flags: act.flags,
            suspended_rate_2026: act.suspended_rate_2026
        };
    }

    /**
     * Find the correct act code based on extracted intent
     */
    findActByIntent(intent: ActIntent): ActData | null {
        // Get base code for operation type
        let baseCode = OPERATION_BASE_CODES[intent.operation_type];

        // Handle nuda propiedad variant
        if (intent.special_flags?.is_nuda_propiedad && intent.operation_type === "COMPRAVENTA") {
            baseCode = "103";
        }

        if (!baseCode) {
            console.warn(`Unknown operation type: ${intent.operation_type}`);
            return null;
        }

        // Determine subcode
        const subcode = determineSubcode(intent);
        const fullCode = `${baseCode}${subcode}`;

        // Try exact match first
        let act = this.getActByCode(fullCode);

        // Fallback to base code if subcode not found
        if (!act) {
            act = this.getActByCode(`${baseCode}-00`);
        }

        return act;
    }

    /**
     * Search acts by description keyword
     */
    searchByDescription(keyword: string): ActData[] {
        const results: ActData[] = [];
        const normalizedKeyword = keyword.toUpperCase();

        for (const [code, act] of Object.entries(this.acts)) {
            if ((act as any).description?.toUpperCase().includes(normalizedKeyword)) {
                results.push({
                    code,
                    description: (act as any).description,
                    category: (act as any).category,
                    tax_variables: (act as any).tax_variables,
                    flags: (act as any).flags,
                    suspended_rate_2026: (act as any).suspended_rate_2026
                });
            }
        }

        return results;
    }

    /**
     * Get all act codes (useful for validation)
     */
    getAllCodes(): string[] {
        return Object.keys(this.acts);
    }

    /**
     * Calculate fees for a given code and amount
     */
    calculateFees(code: string, amount: number): {
        honorario_minimo: number;
        aporte_terceros: number;
        impuesto_sellos: number;
        tasa_retributiva: number;
    } | null {
        const act = this.getActByCode(code);
        if (!act) return null;

        // Parse fee amounts from strings like "$ 891000"
        const parseFee = (fee: string): number => {
            const match = fee.match(/\$?\s*([\d,.]+)/);
            return match ? parseFloat(match[1].replace(/\./g, '').replace(',', '.')) : 0;
        };

        const fees = act.tax_variables.fees_extracted || [];
        const honorario_minimo = fees[0] ? parseFee(fees[0]) : 0;
        const aporte_terceros = fees[1] ? parseFee(fees[1]) : 0;

        // Calculate stamp duty
        const impuesto_sellos = act.suspended_rate_2026 ? 0 : amount * act.tax_variables.stamp_duty_rate;

        // Tasa retributiva (4‰ if not suspended)
        const tasa_retributiva = act.suspended_rate_2026 ? 0 : amount * 0.004;

        return {
            honorario_minimo,
            aporte_terceros,
            impuesto_sellos,
            tasa_retributiva
        };
    }
}

// Export singleton instance
export const taxonomyService = new TaxonomyService();
