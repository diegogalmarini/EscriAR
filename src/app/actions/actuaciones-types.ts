// ---------------------------------------------------------------------------
// Types and constants for Actuaciones (NOT "use server" — safe to export values)
// ---------------------------------------------------------------------------

export interface Actuacion {
    id: string;
    org_id: string;
    carpeta_id: string;
    operacion_id: string | null;
    categoria: "PRIVADO" | "PROTOCOLAR";
    act_type: string;
    modelo_id: string | null;
    status: "DRAFT" | "GENERANDO" | "LISTO" | "ERROR";
    docx_path: string | null;
    pdf_path: string | null;
    html_preview: string | null;
    content_text: string | null;
    metadata: Record<string, any>;
    generation_context: Record<string, any> | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

/** Actos que se clasifican como PRIVADOS (instrumentos privados, no van a protocolo) */
export const ACTOS_PRIVADOS: string[] = [
    "boleto_compraventa",
    "sena",
    "cesion_boleto",
    "certificacion_firmas",
];

/** Actos que pueden ser privados O protocolares según el caso */
export const ACTOS_AMBIGUOS: string[] = [
    "cesion_derechos",
    "cesion_derecho_uso",
    "autorizacion_conducir",
];

/** Actos ocultos / en desarrollo — no se muestran en la UI */
export const ACTOS_OCULTOS: string[] = [];

export type CategoriaActo = "PRIVADO" | "PROTOCOLAR" | "AMBIGUO" | "HIDDEN";

/** Determina la categoría de un act_type */
export function categoriaForActType(actType: string): CategoriaActo {
    if (ACTOS_OCULTOS.includes(actType)) return "HIDDEN";
    if (ACTOS_PRIVADOS.includes(actType)) return "PRIVADO";
    if (ACTOS_AMBIGUOS.includes(actType)) return "AMBIGUO";
    return "PROTOCOLAR";
}
