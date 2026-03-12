// ---------------------------------------------------------------------------
// Types and constants for Modelos (NOT "use server" — safe to export values)
// ---------------------------------------------------------------------------

export type InstrumentCategory = "ESCRITURA_PUBLICA" | "INSTRUMENTO_PRIVADO" | "PRESUPUESTO";

export interface ModeloActo {
    id: string;
    act_type: string;
    act_code: string | null;
    template_name: string;
    label: string | null;
    description: string | null;
    instrument_category: InstrumentCategory;
    version: number;
    is_active: boolean;
    docx_path: string;
    metadata: any;
    total_variables: number;
    categories: string[];
    created_at: string;
    updated_at: string;
}

export const INSTRUMENT_CATEGORY_LABELS: Record<InstrumentCategory, string> = {
    ESCRITURA_PUBLICA: "Escrituras",
    INSTRUMENTO_PRIVADO: "Instrumentos Privados",
    PRESUPUESTO: "Presupuestos",
};

/** Actos soportados para el dropdown cuando act_type viene como "auto" */
export const SUPPORTED_ACT_TYPES = [
    // ── Compraventas ──
    { value: "compraventa", label: "Compraventa", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "venta_anexion", label: "Venta y Anexión", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "boleto_compraventa", label: "Boleto de Compraventa", instrumentCategory: "INSTRUMENTO_PRIVADO" as InstrumentCategory },
    { value: "sena", label: "Seña", instrumentCategory: "INSTRUMENTO_PRIVADO" as InstrumentCategory },
    // ── Hipotecas ──
    { value: "hipoteca", label: "Hipoteca", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "cancelacion_hipoteca", label: "Cancelación de Hipoteca", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    // ── Donaciones ──
    { value: "donacion", label: "Donación", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "donacion_dineraria", label: "Donación Dineraria", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "donacion_usufructo", label: "Donación con Reserva de Usufructo", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "donacion_reversion_usufructo", label: "Donación con Reversión de Usufructo", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    // ── Cesiones ──
    { value: "cesion_derechos", label: "Cesión de Derechos", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "cesion_derecho_uso", label: "Cesión de Derecho de Uso", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "cesion_boleto", label: "Cesión de Boleto", instrumentCategory: "INSTRUMENTO_PRIVADO" as InstrumentCategory },
    // ── Distractos / Desvinculación ──
    { value: "distracto_condominio", label: "Distracto de Condominio", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "distracto_donacion", label: "Distracto de Donación", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "convenio_desvinculacion", label: "Convenio de Desvinculación", instrumentCategory: "INSTRUMENTO_PRIVADO" as InstrumentCategory },
    // ── Poderes Especiales ──
    { value: "poder_especial_compra", label: "Poder Especial para Compra", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "poder_especial_venta", label: "Poder Especial para Venta", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "poder_especial_donacion", label: "Poder Especial para Donación", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "poder_especial_escrituracion", label: "Poder Especial para Escrituración", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "poder_especial_juicio", label: "Poder Especial para Juicio", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    // ── Poderes Generales ──
    { value: "poder_general_administracion", label: "Poder General de Administración", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "poder_general_bancario", label: "Poder General Bancario", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "poder_general_juicios", label: "Poder General para Juicios", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "poder", label: "Poder (genérico)", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    // ── Actas ──
    { value: "acta_comprobacion", label: "Acta de Comprobación", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "acta_comprobacion_terminal", label: "Acta de Comprobación (Terminal)", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "acta_constatacion", label: "Acta de Constatación", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "acta_manifestacion", label: "Acta de Manifestación", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "acta_manifestacion_firma", label: "Acta de Manifestación de Firma", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    // ── Otros actos ──
    { value: "dacion_en_pago", label: "Dación en Pago", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "division_condominio", label: "División de Condominio", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "permuta", label: "Permuta", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "usufructo", label: "Usufructo", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "afectacion_vivienda", label: "Afectación a Vivienda", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "fideicomiso", label: "Fideicomiso", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "constitucion_sociedad", label: "Constitución de Sociedad", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "declaratoria_herederos", label: "Declaratoria de Herederos", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "testamento", label: "Testamento", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "servidumbre", label: "Servidumbre", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "reglamento_ph", label: "Reglamento PH", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "regimen_patrimonial", label: "Régimen Patrimonial", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "escritura_complementaria", label: "Escritura Complementaria", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "autorizacion_conducir", label: "Autorización a Conducir", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "protocolizacion", label: "Protocolización", instrumentCategory: "ESCRITURA_PUBLICA" as InstrumentCategory },
    { value: "certificacion_firmas", label: "Certificación de Firmas", instrumentCategory: "INSTRUMENTO_PRIVADO" as InstrumentCategory },
    // ── Presupuestos ──
    { value: "presupuesto", label: "Presupuesto", instrumentCategory: "PRESUPUESTO" as InstrumentCategory },
] as const;

/** Filtra tipos de acto por categoría de instrumento */
export function getActTypesForCategory(cat: InstrumentCategory) {
    return SUPPORTED_ACT_TYPES.filter(t => t.instrumentCategory === cat);
}
