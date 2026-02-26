// ---------------------------------------------------------------------------
// Types and constants for Modelos (NOT "use server" — safe to export values)
// ---------------------------------------------------------------------------

export interface ModeloActo {
    id: string;
    act_type: string;
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
    { value: "compraventa", label: "Compraventa" },
    { value: "hipoteca", label: "Hipoteca" },
    { value: "donacion", label: "Donación" },
    { value: "cancelacion_hipoteca", label: "Cancelación de Hipoteca" },
    { value: "cesion_derechos", label: "Cesión de Derechos" },
    { value: "usufructo", label: "Usufructo" },
    { value: "afectacion_vivienda", label: "Afectación a Vivienda" },
    { value: "division_condominio", label: "División de Condominio" },
    { value: "fideicomiso", label: "Fideicomiso" },
    { value: "poder", label: "Poder" },
    { value: "constitucion_sociedad", label: "Constitución de Sociedad" },
    { value: "declaratoria_herederos", label: "Declaratoria de Herederos" },
    { value: "testamento", label: "Testamento" },
    { value: "permuta", label: "Permuta" },
    { value: "dacion_en_pago", label: "Dación en Pago" },
    { value: "servidumbre", label: "Servidumbre" },
    { value: "reglamento_ph", label: "Reglamento PH" },
    { value: "autorizacion_vehicular", label: "Autorización Vehicular / a Conducir" },
    { value: "protocolizacion", label: "Protocolización" },
    { value: "certificacion_firmas", label: "Certificación de Firmas" },
    { value: "acta_constatacion", label: "Acta de Constatación" },
] as const;
