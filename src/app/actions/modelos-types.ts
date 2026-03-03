// ---------------------------------------------------------------------------
// Types and constants for Modelos (NOT "use server" — safe to export values)
// ---------------------------------------------------------------------------

export interface ModeloActo {
    id: string;
    act_type: string;
    act_code: string | null;
    template_name: string;
    label: string | null;
    description: string | null;
    instrument_category: string;
    version: number;
    is_active: boolean;
    docx_path: string;
    metadata: any;
    total_variables: number;
    categories: string[];
    created_at: string;
    updated_at: string;
}

/** Actos soportados para el dropdown cuando act_type viene como "auto" */
export const SUPPORTED_ACT_TYPES = [
    // ── Compraventas ──
    { value: "compraventa", label: "Compraventa" },
    { value: "venta_anexion", label: "Venta y Anexión" },
    { value: "boleto_compraventa", label: "Boleto de Compraventa" },
    { value: "sena", label: "Seña" },
    // ── Hipotecas ──
    { value: "hipoteca", label: "Hipoteca" },
    { value: "cancelacion_hipoteca", label: "Cancelación de Hipoteca" },
    // ── Donaciones ──
    { value: "donacion", label: "Donación" },
    { value: "donacion_dineraria", label: "Donación Dineraria" },
    { value: "donacion_usufructo", label: "Donación con Reserva de Usufructo" },
    { value: "donacion_reversion_usufructo", label: "Donación con Reversión de Usufructo" },
    // ── Cesiones ──
    { value: "cesion_derechos", label: "Cesión de Derechos" },
    { value: "cesion_derecho_uso", label: "Cesión de Derecho de Uso" },
    { value: "cesion_boleto", label: "Cesión de Boleto" },
    // ── Distractos / Desvinculación ──
    { value: "distracto_condominio", label: "Distracto de Condominio" },
    { value: "distracto_donacion", label: "Distracto de Donación" },
    { value: "convenio_desvinculacion", label: "Convenio de Desvinculación" },
    // ── Poderes Especiales ──
    { value: "poder_especial_compra", label: "Poder Especial para Compra" },
    { value: "poder_especial_venta", label: "Poder Especial para Venta" },
    { value: "poder_especial_donacion", label: "Poder Especial para Donación" },
    { value: "poder_especial_escrituracion", label: "Poder Especial para Escrituración" },
    { value: "poder_especial_juicio", label: "Poder Especial para Juicio" },
    // ── Poderes Generales ──
    { value: "poder_general_administracion", label: "Poder General de Administración" },
    { value: "poder_general_bancario", label: "Poder General Bancario" },
    { value: "poder_general_juicios", label: "Poder General para Juicios" },
    { value: "poder", label: "Poder (genérico)" },
    // ── Actas ──
    { value: "acta_comprobacion", label: "Acta de Comprobación" },
    { value: "acta_comprobacion_terminal", label: "Acta de Comprobación (Terminal)" },
    { value: "acta_constatacion", label: "Acta de Constatación" },
    { value: "acta_manifestacion", label: "Acta de Manifestación" },
    { value: "acta_manifestacion_firma", label: "Acta de Manifestación de Firma" },
    // ── Otros actos ──
    { value: "dacion_en_pago", label: "Dación en Pago" },
    { value: "division_condominio", label: "División de Condominio" },
    { value: "permuta", label: "Permuta" },
    { value: "usufructo", label: "Usufructo" },
    { value: "afectacion_vivienda", label: "Afectación a Vivienda" },
    { value: "fideicomiso", label: "Fideicomiso" },
    { value: "constitucion_sociedad", label: "Constitución de Sociedad" },
    { value: "declaratoria_herederos", label: "Declaratoria de Herederos" },
    { value: "testamento", label: "Testamento" },
    { value: "servidumbre", label: "Servidumbre" },
    { value: "reglamento_ph", label: "Reglamento PH" },
    { value: "regimen_patrimonial", label: "Régimen Patrimonial" },
    { value: "escritura_complementaria", label: "Escritura Complementaria" },
    { value: "autorizacion_conducir", label: "Autorización a Conducir" },
    { value: "protocolizacion", label: "Protocolización" },
    { value: "certificacion_firmas", label: "Certificación de Firmas" },
] as const;
