/**
 * Generación de carátula dinámica para carpetas.
 * Módulo isomórfico: funciona en server y client.
 *
 * Formato: "ADQUIRENTE de TRANSMITENTE" (ej: "GALMARINI de PÉREZ RODRIGUEZ")
 */

const ROLES_TRANSMITENTE = ["VENDEDOR", "TRANSMITENTE", "DONANTE", "CEDENTE", "FIDUCIANTE", "TITULAR", "CONDOMINO"];
const ROLES_ADQUIRENTE = ["COMPRADOR", "ADQUIRENTE", "DONATARIO", "CESIONARIO", "MUTUARIO", "FIDEICOMISARIO"];

const ACTOS_CONOCIDOS = [
    "COMPRAVENTA", "HIPOTECA", "DONACIÓN", "DONACION", "CESIÓN DE DERECHOS",
    "CESION DE DERECHOS", "PODER ESPECIAL", "PODER GENERAL", "CANCELACIÓN",
    "CANCELACION", "USUFRUCTO", "PERMUTA", "FIDEICOMISO", "AFECTACIÓN",
    "AFECTACION", "DESAFECTACIÓN", "DESAFECTACION",
];

/** Extrae el apellido de un nombre_completo ("APELLIDO, Nombre" o "Nombre APELLIDO") */
export function extractApellido(nombreCompleto: string | null | undefined): string | null {
    if (!nombreCompleto?.trim()) return null;
    const trimmed = nombreCompleto.trim();

    // Formato DB estándar: "APELLIDO, Nombre"
    if (trimmed.includes(",")) {
        return trimmed.split(",")[0].trim() || null;
    }

    // Formato alternativo: "Nombre APELLIDO" — buscar palabra en MAYÚSCULAS
    const parts = trimmed.split(/\s+/);
    const upper = parts.filter(
        (p) => p.length > 1 && p === p.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(p)
    );
    if (upper.length > 0) return upper[0];

    // Fallback: última palabra en mayúsculas
    return parts[parts.length - 1]?.toUpperCase() || null;
}

/**
 * Genera carátula dinámica a partir de datos completos de carpeta
 * (con escrituras → operaciones → participantes → personas anidados).
 */
export function generarCaratula(carpeta: any): { titulo: string; subtipo: string } {
    const escritura = carpeta.escrituras?.find((e: any) => e.source === "TRAMITE") || carpeta.escrituras?.[0];
    const operacion = escritura?.operaciones?.[0];

    const rawActo = operacion?.tipo_acto?.toUpperCase()?.trim() || null;
    const tipoActoRaw = rawActo === "POR_DEFINIR" ? null : rawActo;
    const tipoActo = tipoActoRaw
        ? (ACTOS_CONOCIDOS.find((a) => tipoActoRaw.includes(a)) || tipoActoRaw)
        : null;
    const subtipo = tipoActo || "ACTO POR SELECCIONAR";

    if (carpeta.ingesta_estado === "PROCESANDO" && !tipoActo) {
        return { titulo: "Procesando operación…", subtipo };
    }

    const participantes = operacion?.participantes_operacion || [];

    const transmitente = participantes.find((p: any) =>
        ROLES_TRANSMITENTE.includes(p.rol?.toUpperCase() || "")
    );
    const adquirente = participantes.find((p: any) =>
        ROLES_ADQUIRENTE.includes(p.rol?.toUpperCase() || "")
    );

    const apellidoTransmitente = extractApellido(transmitente?.persona?.nombre_completo);
    const apellidoAdquirente = extractApellido(adquirente?.persona?.nombre_completo);

    let titulo: string;
    if (apellidoAdquirente && apellidoTransmitente) {
        titulo = `${apellidoAdquirente} de ${apellidoTransmitente}`;
    } else if (apellidoTransmitente) {
        titulo = `… de ${apellidoTransmitente}`;
    } else if (apellidoAdquirente) {
        titulo = apellidoAdquirente;
    } else {
        titulo = carpeta.caratula?.replace(".pdf", "") || "Nuevo trámite";
    }

    return { titulo, subtipo };
}

/**
 * Genera un label corto para una carpeta a partir del array `parties` del RPC search_carpetas.
 * parties = [{ full_name, role }, ...]
 * Formato: "ADQUIRENTE de TRANSMITENTE" como generarCaratula pero desde datos planos.
 */
export function generarLabelDesdeParties(
    parties: { full_name?: string; role?: string }[] | null | undefined,
    fallback: string
): string {
    if (!parties || parties.length === 0) return fallback;

    const transmitente = parties.find((p) =>
        ROLES_TRANSMITENTE.includes(p.role?.toUpperCase() || "")
    );
    const adquirente = parties.find((p) =>
        ROLES_ADQUIRENTE.includes(p.role?.toUpperCase() || "")
    );

    const apellidoT = extractApellido(transmitente?.full_name);
    const apellidoA = extractApellido(adquirente?.full_name);

    if (apellidoA && apellidoT) return `${apellidoA} de ${apellidoT}`;
    if (apellidoT) return `… de ${apellidoT}`;
    if (apellidoA) return apellidoA;

    // Fallback: primer nombre con apellido
    const first = extractApellido(parties[0]?.full_name);
    return first || fallback;
}
