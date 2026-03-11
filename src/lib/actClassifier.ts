/**
 * Clasifica un tipo_acto libre (abreviaciones notariales) a código(s) CESBA.
 * Devuelve null si no puede clasificar con confianza.
 *
 * Códigos CESBA formato NNN-SS donde NNN = acto base, SS = sufijo fiscal.
 * Actos compuestos se separan con " / " (ej: "100-00 / 713-00").
 */

type Rule = {
    pattern: RegExp;
    code: string;
};

// Orden importa: reglas más específicas primero
const RULES: Rule[] = [
    // ── Escrituras anuladas / no pasadas ──
    { pattern: /no\s*pas[oó]/i, code: "999-00" },
    { pattern: /anulad[ao]/i, code: "999-00" },

    // ── Compuestos (venta + algo) ──
    { pattern: /venta.*t\.?\s*a\.?|compraventa.*tracto/i, code: "100-00 / 713-00" },
    { pattern: /venta.*ext\.?\s*usuf/i, code: "100-00 / 401-30" },
    { pattern: /venta.*renun.*usuf/i, code: "100-00 / 414-30" },
    { pattern: /venta.*cancel.*hip/i, code: "100-00 / 311-00" },
    { pattern: /venta.*hip[oó]t/i, code: "100-00 / 300-00" },

    // ── Compraventas ──
    { pattern: /compraventa|^venta/i, code: "100-00" },

    // ── Tracto abreviado (solo) ──
    { pattern: /tracto\s*abrev/i, code: "713-00" },

    // ── Donaciones ──
    { pattern: /donac/i, code: "200-30" },

    // ── Hipotecas ──
    { pattern: /cancel.*hip[oó]t/i, code: "311-00" },
    { pattern: /cont.*cr[eé]d.*hip|hip[oó]t.*cr[eé]d|const.*hip/i, code: "300-00" },
    { pattern: /hip[oó]t/i, code: "300-00" },

    // ── Usufructo ──
    { pattern: /renun.*usuf/i, code: "414-30" },
    { pattern: /ext.*usuf/i, code: "401-30" },
    { pattern: /const.*usuf|usufruct/i, code: "400-00" },

    // ── Vivienda ──
    { pattern: /desaf.*vivien/i, code: "501-32" },
    { pattern: /afect.*vivien/i, code: "500-32" },

    // ── Propiedad horizontal ──
    { pattern: /reglam.*p\.?\s*h|afect.*horiz/i, code: "512-30" },

    // ── Sucesiones / herencia ──
    { pattern: /adj.*disol.*soc.*cony|disol.*soc.*cony/i, code: "709-00" },
    { pattern: /adj.*parti|partic.*herenc/i, code: "716-00" },
    { pattern: /ces.*der.*her.*s.*inm.*oner/i, code: "720-00" },
    { pattern: /ces.*der.*her/i, code: "700-00" },
    { pattern: /declarator.*hered/i, code: "707-00" },
    { pattern: /renun.*herenc/i, code: "730-00" },
    { pattern: /inscr.*declarator/i, code: "707-00" },

    // ── División condominio ──
    { pattern: /divis.*condom/i, code: "705-00" },

    // ── Sociedades ──
    { pattern: /const.*soc|soc.*const/i, code: "600-20" },
    { pattern: /protocol.*disol|adj.*liq.*soc/i, code: "606-00" },
    { pattern: /fusi[oó]n.*soc/i, code: "605-00" },
    { pattern: /transf.*soc|reform.*estat/i, code: "604-00" },

    // ── Fideicomiso ──
    { pattern: /transf.*fiduc|fideic/i, code: "108-30" },
    { pattern: /transf.*benef/i, code: "121-00" },

    // ── Dación en pago ──
    { pattern: /daci[oó]n.*pago/i, code: "110-00" },

    // ── Permuta ──
    { pattern: /permut/i, code: "107-00" },

    // ── Distracto ──
    { pattern: /distract/i, code: "105-00" },

    // ── Complementaria / Rectificatoria ──
    { pattern: /complement|aclarator|rectificat/i, code: "702-20" },

    // ── Anotación marginal ──
    { pattern: /anot.*marg/i, code: "701-00" },

    // ── Segundo testimonio ──
    { pattern: /segund.*testim|2.*testim/i, code: "708-00" },

    // ── Obra nueva ──
    { pattern: /obra\s*nuev/i, code: "515-00" },

    // ── Servidumbre ──
    { pattern: /servidum/i, code: "404-00" },

    // ── Cancelación general ──
    { pattern: /cancel/i, code: "311-00" },

    // ── Cesión derechos (no hereditarios) ──
    { pattern: /ces.*der.*acc/i, code: "902-00" },
    { pattern: /ces.*bol/i, code: "825-00" },
    { pattern: /ces.*cuot/i, code: "604-00" },

    // ── Boleto ──
    { pattern: /bolet.*compra/i, code: "824-02" },

    // ── Locación ──
    { pattern: /locac|contrat.*locac/i, code: "857-02" },

    // ── Automotores ──
    { pattern: /autom.*nuev|formul.*08/i, code: "813-02" },
    { pattern: /autom.*usad/i, code: "814-02" },

    // ── Protocolización ──
    { pattern: /protocol/i, code: "875-30" },

    // ── Reconocimiento de deuda ──
    { pattern: /reconoc.*deud/i, code: "879-30" },

    // ── Testamento ──
    { pattern: /testam/i, code: "800-32" },

    // ── Convenciones matrimoniales ──
    { pattern: /convenc.*matrim|pacto.*conviv/i, code: "801-00" },

    // ── Compensación / bonificación ──
    { pattern: /bonific|compens/i, code: "900-00" },

    // ── Desembolso (crédito hipotecario) ──
    { pattern: /desembols/i, code: "300-00" },

    // ── Actas y poderes → catch-all 800-32 ──
    { pattern: /^acta|acta\b/i, code: "800-32" },
    { pattern: /poder|pod\b|pod\./i, code: "800-32" },

    // ── Renta vitalicia ──
    { pattern: /renta\s*vital/i, code: "410-00" },

    // ── Prenda ──
    { pattern: /prend/i, code: "866-00" },

    // ── Leasing ──
    { pattern: /leasing/i, code: "109-00" },
];

/**
 * Clasifica un tipo_acto a código CESBA.
 * @returns El código CESBA o null si no se puede clasificar.
 */
export function classifyActo(tipoActo: string | null | undefined): string | null {
    if (!tipoActo || !tipoActo.trim()) return null;

    const normalized = tipoActo.trim();

    // Primero: check "NO PASO" / anulada — siempre gana
    if (/no\s*pas[oó]/i.test(normalized)) return "999-00";
    if (/anulad[ao]/i.test(normalized)) return "999-00";

    for (const rule of RULES) {
        if (rule.pattern.test(normalized)) {
            return rule.code;
        }
    }

    return null;
}
