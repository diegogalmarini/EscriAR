/**
 * ETAPA 5 — Motor determinístico de sugerencias
 *
 * Ejecuta cambios reales en la BD según el tipo de sugerencia.
 * Cada handler es idempotente y devuelve un audit trail.
 *
 * Payload de Gemini: { descripcion: string, campo?: string, valor?: string }
 * evidencia_texto se pasa separado desde la sugerencia.
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface ApplyContext {
    carpetaId: string;
    orgId: string;
    userId: string;
    evidenciaTexto?: string;
}

export interface ApplyResult {
    success: boolean;
    applied_changes: Record<string, any> | null;
    error?: string;
}

type Handler = (
    supabase: SupabaseClient,
    payload: any,
    context: ApplyContext
) => Promise<ApplyResult>;

// ─── Dispatcher ───────────────────────────────────────────
const handlers: Record<string, Handler> = {
    AGREGAR_PERSONA: handleAgregarPersona,
    COMPLETAR_DATOS: handleCompletarDatos,
    AGREGAR_CERTIFICADO: handleAgregarCertificado,
    VERIFICAR_DATO: handleInformational,
    ACCION_REQUERIDA: handleInformational,
};

export async function applySuggestion(
    supabase: SupabaseClient,
    tipo: string,
    payload: any,
    context: ApplyContext
): Promise<ApplyResult> {
    const handler = handlers[tipo];
    if (!handler) {
        return { success: false, applied_changes: null, error: `Tipo desconocido: ${tipo}` };
    }
    try {
        return await handler(supabase, payload, context);
    } catch (err: any) {
        return { success: false, applied_changes: null, error: `Excepción en handler ${tipo}: ${err.message}` };
    }
}

// ─── Helpers ──────────────────────────────────────────────

/** Obtiene la primera operación de la carpeta (cadena: carpeta → escritura → operación) */
async function getFirstOperacion(supabase: SupabaseClient, carpetaId: string) {
    const { data: escritura, error: escErr } = await supabase
        .from("escrituras")
        .select("id")
        .eq("carpeta_id", carpetaId)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

    if (escErr || !escritura) {
        console.log(`[ET5] getFirstOperacion: no escritura para carpeta ${carpetaId}`, escErr?.message);
        return null;
    }

    const { data: operacion, error: opErr } = await supabase
        .from("operaciones")
        .select("id, monto_operacion, tipo_acto, codigo")
        .eq("escritura_id", escritura.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

    if (opErr || !operacion) {
        console.log(`[ET5] getFirstOperacion: no operación para escritura ${escritura.id}`, opErr?.message);
        return null;
    }

    console.log(`[ET5] getFirstOperacion: operacion_id=${operacion.id} tipo_acto=${operacion.tipo_acto}`);
    return operacion;
}

/** Mapea strings de rol libre a los roles canónicos del enum participantes_operacion */
const ROL_MAP: Record<string, string> = {
    vendedor: "VENDEDOR",
    vendedora: "VENDEDOR",
    transmitente: "TRANSMITENTE",
    comprador: "COMPRADOR",
    compradora: "COMPRADOR",
    adquirente: "ADQUIRENTE",
    donante: "DONANTE",
    donatario: "DONATARIO",
    donataria: "DONATARIO",
    acreedor: "ACREEDOR",
    acreedora: "ACREEDOR",
    deudor: "DEUDOR",
    deudora: "DEUDOR",
    mutuante: "MUTUANTE",
    mutuario: "MUTUARIO",
    mutuaria: "MUTUARIO",
    garante: "GARANTE",
    fiduciante: "FIDUCIANTE",
    fiduciario: "FIDUCIARIO",
    fideicomisario: "FIDEICOMISARIO",
    apoderado: "APODERADO",
    apoderada: "APODERADO",
    representante: "REPRESENTANTE",
    conyuge: "CONYUGE",
    "cónyuge": "CONYUGE",
    esposa: "CONYUGE",
    esposo: "CONYUGE",
    escribano: "ESCRIBANO",
    condomino: "CONDOMINO",
    condómino: "CONDOMINO",
    parte: "PARTE",
    cedente: "CEDENTE",
    cesionario: "CESIONARIO",
    cesionaria: "CESIONARIO",
    usufructuario: "USUFRUCTUARIO",
    usufructuaria: "USUFRUCTUARIO",
    nudo_propietario: "NUDO_PROPIETARIO",
};

function normalizeRol(raw: string): string {
    const key = raw.toLowerCase().trim().replace(/\s+/g, "_");
    return ROL_MAP[key] || "PARTE";
}

/** Intenta extraer un DNI (7-8 dígitos) de un texto */
function extractDni(text: string): string | null {
    // Buscar patrones: DNI 30.555.123, DNI 30555123, D.N.I. Nº 30.555.123
    const match = text.match(/(?:DNI|D\.N\.I\.?|documento)\s*(?:N[°ºo]?\s*)?(\d{1,3}[.\s]?\d{3}[.\s]?\d{3})/i);
    if (match) {
        return match[1].replace(/[.\s]/g, "");
    }
    // Fallback: buscar secuencia de 7-8 dígitos sueltos
    const digits = text.match(/\b(\d{7,8})\b/);
    return digits ? digits[1] : null;
}

/** Intenta extraer un rol del texto descriptivo */
function extractRolFromText(text: string): string {
    const lower = text.toLowerCase();
    for (const [keyword, role] of Object.entries(ROL_MAP)) {
        if (lower.includes(keyword)) return role;
    }
    return "PARTE";
}

/** Intenta extraer un nombre de un texto descriptivo */
function extractNombreFromDescripcion(text: string): string | null {
    // Patrones: "Agregar a Juan Pérez como vendedor", "María García, compradora"
    const match = text.match(/(?:agregar\s+a\s+)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+)/);
    return match ? match[1] : null;
}

// ─── AGREGAR_PERSONA ──────────────────────────────────────
async function handleAgregarPersona(
    supabase: SupabaseClient,
    payload: any,
    ctx: ApplyContext
): Promise<ApplyResult> {
    // Extraer nombre: de valor, campo, o parsear de descripcion
    const nombre = payload.valor
        || extractNombreFromDescripcion(payload.descripcion || "")
        || payload.campo;

    // Extraer DNI: del payload, de evidencia_texto, o de descripcion
    const dniFromPayload = payload.dni;
    const dniFromEvidencia = ctx.evidenciaTexto ? extractDni(ctx.evidenciaTexto) : null;
    const dniFromDescripcion = extractDni(payload.descripcion || "");
    const dni = dniFromPayload || dniFromEvidencia || dniFromDescripcion;

    // Extraer rol
    const rolRaw = payload.rol || payload.campo || payload.descripcion || "";
    const rol = normalizeRol(rolRaw) !== "PARTE"
        ? normalizeRol(rolRaw)
        : extractRolFromText(payload.descripcion || "");

    console.log(`[ET5] AGREGAR_PERSONA: nombre="${nombre}", dni="${dni}", rol="${rol}", payload=${JSON.stringify(payload)}`);

    if (!nombre && !dni) {
        return {
            success: false,
            applied_changes: null,
            error: "No se pudo determinar nombre ni DNI de la persona. Agregue manualmente.",
        };
    }

    if (!dni) {
        return {
            success: false,
            applied_changes: null,
            error: `No se encontró DNI para "${nombre}". Agregue la persona manualmente con su DNI.`,
        };
    }

    // 1. Buscar o crear persona por DNI
    const { data: existing } = await supabase
        .from("personas")
        .select("dni, nombre_completo")
        .eq("dni", dni)
        .maybeSingle();

    console.log(`[ET5] AGREGAR_PERSONA: persona existente=${existing ? existing.nombre_completo : 'NO'}`);

    if (!existing) {
        // Insert persona y VERIFICAR que se creó (RLS puede bloquear silenciosamente)
        const { data: newPersona, error: insertErr } = await supabase
            .from("personas")
            .insert({ dni, nombre_completo: nombre || `Persona DNI ${dni}`, tipo_persona: "FISICA" })
            .select("dni")
            .single();

        if (insertErr) {
            return { success: false, applied_changes: null, error: `Error creando persona: ${insertErr.message}` };
        }
        if (!newPersona) {
            return { success: false, applied_changes: null, error: `RLS bloqueó creación de persona DNI ${dni}. Verifique permisos.` };
        }
        console.log(`[ET5] AGREGAR_PERSONA: persona creada dni=${newPersona.dni}`);
    }

    // 2. Obtener operación activa
    const operacion = await getFirstOperacion(supabase, ctx.carpetaId);
    if (!operacion) {
        return {
            success: false,
            applied_changes: null,
            error: "No se encontró operación activa en la carpeta",
        };
    }

    // 3. Verificar si ya está vinculado (idempotencia)
    const { data: existingLink } = await supabase
        .from("participantes_operacion")
        .select("id")
        .eq("operacion_id", operacion.id)
        .eq("persona_id", dni)
        .maybeSingle();

    if (existingLink) {
        console.log(`[ET5] AGREGAR_PERSONA: ya vinculado como participante`);
        return {
            success: true,
            applied_changes: {
                persona_dni: dni,
                nombre: existing?.nombre_completo || nombre,
                operacion_id: operacion.id,
                rol,
                ya_existia: true,
            },
        };
    }

    // 4. Vincular — usar .select().single() para detectar si RLS bloquea
    console.log(`[ET5] AGREGAR_PERSONA: insertando participante operacion_id=${operacion.id} persona_id=${dni} rol=${rol}`);
    const { data: linkData, error: linkErr } = await supabase
        .from("participantes_operacion")
        .insert({ operacion_id: operacion.id, persona_id: dni, rol })
        .select("id")
        .single();

    if (linkErr) {
        console.error(`[ET5] AGREGAR_PERSONA: error vinculando:`, linkErr.message, linkErr.details, linkErr.hint);
        return {
            success: false,
            applied_changes: { persona_dni: dni, operacion_id: operacion.id },
            error: `Error vinculando participante: ${linkErr.message}`,
        };
    }
    if (!linkData) {
        return {
            success: false,
            applied_changes: { persona_dni: dni, operacion_id: operacion.id },
            error: `INSERT en participantes_operacion no devolvió datos. Posible bloqueo RLS.`,
        };
    }

    console.log(`[ET5] AGREGAR_PERSONA: vinculado OK, participante_id=${linkData.id}`);
    return {
        success: true,
        applied_changes: {
            persona_dni: dni,
            nombre: existing?.nombre_completo || nombre,
            operacion_id: operacion.id,
            participante_id: linkData.id,
            rol,
            ya_existia: false,
        },
    };
}

// ─── COMPLETAR_DATOS ──────────────────────────────────────
async function handleCompletarDatos(
    supabase: SupabaseClient,
    payload: any,
    ctx: ApplyContext
): Promise<ApplyResult> {
    const campo = payload.campo;
    const valor = payload.valor;

    if (!campo || valor === undefined) {
        return { success: false, applied_changes: null, error: "campo o valor faltante en payload" };
    }

    const camposOperacion: Record<string, string> = {
        monto: "monto_operacion",
        monto_operacion: "monto_operacion",
        tipo_acto: "tipo_acto",
        codigo: "codigo",
    };

    const campoNorm = campo.toLowerCase().replace(/\s+/g, "_");
    const dbColumn = camposOperacion[campoNorm];

    if (dbColumn) {
        const operacion = await getFirstOperacion(supabase, ctx.carpetaId);
        if (!operacion) {
            return { success: false, applied_changes: null, error: "Sin operación en carpeta" };
        }

        const updateData: Record<string, any> = {};
        updateData[dbColumn] = dbColumn === "monto_operacion" ? parseFloat(valor) : valor;

        const { error } = await supabase
            .from("operaciones")
            .update(updateData)
            .eq("id", operacion.id);

        if (error) {
            return { success: false, applied_changes: null, error: `Error actualizando operación: ${error.message}` };
        }

        return {
            success: true,
            applied_changes: {
                tabla: "operaciones",
                operacion_id: operacion.id,
                campo: dbColumn,
                valor_nuevo: updateData[dbColumn],
                valor_anterior: (operacion as any)[dbColumn],
            },
        };
    }

    if (campoNorm === "caratula") {
        const { error } = await supabase
            .from("carpetas")
            .update({ caratula: valor })
            .eq("id", ctx.carpetaId);

        if (error) {
            return { success: false, applied_changes: null, error: `Error actualizando carpeta: ${error.message}` };
        }

        return {
            success: true,
            applied_changes: { tabla: "carpetas", campo: "caratula", valor_nuevo: valor },
        };
    }

    return {
        success: true,
        applied_changes: { campo_no_mapeado: campo, valor, nota: "Campo sin mapeo automático, registrado como audit" },
    };
}

// ─── AGREGAR_CERTIFICADO ──────────────────────────────────
async function handleAgregarCertificado(
    supabase: SupabaseClient,
    payload: any,
    ctx: ApplyContext
): Promise<ApplyResult> {
    const tiposValidos = [
        "DOMINIO", "INHIBICION", "CATASTRAL", "DEUDA_MUNICIPAL",
        "DEUDA_ARBA", "RENTAS", "AFIP", "ANOTACIONES_PERSONALES", "OTRO",
    ];

    const rawTipo = (payload.campo || payload.valor || payload.descripcion || "")
        .toUpperCase()
        .replace(/\s+/g, "_")
        .replace(/CERTIFICADO_?DE_?/g, "")
        .replace(/CERTIFICADO_?/g, "");

    let tipoCert = tiposValidos.find(t => rawTipo.includes(t)) || "OTRO";

    const desc = (payload.descripcion || "").toLowerCase();
    if (tipoCert === "OTRO") {
        if (desc.includes("dominio")) tipoCert = "DOMINIO";
        else if (desc.includes("inhibici")) tipoCert = "INHIBICION";
        else if (desc.includes("catastral") || desc.includes("catastro")) tipoCert = "CATASTRAL";
        else if (desc.includes("municipal")) tipoCert = "DEUDA_MUNICIPAL";
        else if (desc.includes("arba")) tipoCert = "DEUDA_ARBA";
        else if (desc.includes("renta")) tipoCert = "RENTAS";
        else if (desc.includes("afip")) tipoCert = "AFIP";
        else if (desc.includes("anotaciones")) tipoCert = "ANOTACIONES_PERSONALES";
    }

    // Idempotencia: verificar si ya existe del mismo tipo en la carpeta
    const { data: existing } = await supabase
        .from("certificados")
        .select("id, estado")
        .eq("carpeta_id", ctx.carpetaId)
        .eq("tipo", tipoCert)
        .maybeSingle();

    if (existing) {
        return {
            success: true,
            applied_changes: { certificado_id: existing.id, tipo: tipoCert, estado: existing.estado, ya_existia: true },
        };
    }

    const { data: cert, error } = await supabase
        .from("certificados")
        .insert({
            carpeta_id: ctx.carpetaId,
            tipo: tipoCert,
            estado: "PENDIENTE",
            observaciones: payload.descripcion || null,
        })
        .select("id")
        .single();

    if (error) {
        return { success: false, applied_changes: null, error: `Error creando certificado: ${error.message}` };
    }

    return {
        success: true,
        applied_changes: { certificado_id: cert.id, tipo: tipoCert, ya_existia: false },
    };
}

// ─── VERIFICAR_DATO / ACCION_REQUERIDA ────────────────────
async function handleInformational(
    _supabase: SupabaseClient,
    payload: any,
): Promise<ApplyResult> {
    return {
        success: true,
        applied_changes: { tipo: "informational", descripcion: payload.descripcion || "Aceptado por usuario" },
    };
}
