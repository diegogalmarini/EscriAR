/**
 * ETAPA 5 — Motor determinístico de sugerencias
 *
 * Ejecuta cambios reales en la BD según el tipo de sugerencia.
 * Cada handler es idempotente y devuelve un audit trail.
 *
 * Payload estructurado (v2, desde noteAnalyzer actualizado):
 *   AGREGAR_PERSONA:    { descripcion, nombre, dni?, rol }
 *   AGREGAR_CERTIFICADO: { descripcion, tipo_certificado }
 *   COMPLETAR_DATOS:     { descripcion, campo, valor }
 *   VERIFICAR_DATO:      { descripcion }
 *   ACCION_REQUERIDA:    { descripcion }
 *
 * También soporta el formato v1 legacy (campo/valor genérico) con fallback.
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

    console.log(`[ET5] getFirstOperacion: operacion_id=${operacion.id}`);
    return operacion;
}

/** Intenta extraer un DNI de un texto (fallback para payloads v1 legacy) */
function extractDni(text: string): string | null {
    const match = text.match(/(?:DNI|D\.N\.I\.?|documento)\s*(?:N[°ºo]?\s*)?(\d{1,3}[.\s]?\d{3}[.\s]?\d{3})/i);
    if (match) return match[1].replace(/[.\s]/g, "");
    const digits = text.match(/\b(\d{7,8})\b/);
    return digits ? digits[1] : null;
}

// ─── AGREGAR_PERSONA ──────────────────────────────────────
async function handleAgregarPersona(
    supabase: SupabaseClient,
    payload: any,
    ctx: ApplyContext
): Promise<ApplyResult> {
    // v2: payload.nombre, payload.dni, payload.rol (del schema estructurado)
    // v1 fallback: payload.valor, payload.campo, parseo de descripcion/evidencia
    const nombre = payload.nombre || payload.valor || null;
    const rol = payload.rol || "PARTE";

    // DNI: primero del payload estructurado, luego parsear de evidencia/descripcion
    let dni = payload.dni || null;
    if (!dni && ctx.evidenciaTexto) dni = extractDni(ctx.evidenciaTexto);
    if (!dni && payload.descripcion) dni = extractDni(payload.descripcion);

    // Limpiar DNI: quitar puntos y espacios
    if (dni) dni = dni.replace(/[.\s-]/g, "");

    console.log(`[ET5] AGREGAR_PERSONA: nombre="${nombre}", dni="${dni}", rol="${rol}"`);

    if (!dni) {
        // Sin DNI → no podemos crear persona. Reportar fallo con contexto útil.
        return {
            success: false,
            applied_changes: { nombre, rol },
            error: `Falta DNI para "${nombre || 'persona'}". Complete el DNI manualmente para agregar esta persona.`,
        };
    }

    // 1. Buscar o crear persona por DNI
    const { data: existing } = await supabase
        .from("personas")
        .select("dni, nombre_completo")
        .eq("dni", dni)
        .maybeSingle();

    if (!existing) {
        const { data: newPersona, error: insertErr } = await supabase
            .from("personas")
            .insert({ dni, nombre_completo: nombre || `Persona DNI ${dni}`, tipo_persona: "FISICA" })
            .select("dni")
            .single();

        if (insertErr) {
            return { success: false, applied_changes: null, error: `Error creando persona: ${insertErr.message}` };
        }
        if (!newPersona) {
            return { success: false, applied_changes: null, error: `No se pudo crear persona DNI ${dni}. Posible bloqueo RLS.` };
        }
        console.log(`[ET5] AGREGAR_PERSONA: persona creada dni=${dni}`);
    } else {
        console.log(`[ET5] AGREGAR_PERSONA: persona existente=${existing.nombre_completo}`);
    }

    // 2. Obtener operación activa
    const operacion = await getFirstOperacion(supabase, ctx.carpetaId);
    if (!operacion) {
        return { success: false, applied_changes: null, error: "No se encontró operación activa en la carpeta" };
    }

    // 3. Idempotencia: verificar si ya está vinculado
    const { data: existingLink } = await supabase
        .from("participantes_operacion")
        .select("id")
        .eq("operacion_id", operacion.id)
        .eq("persona_id", dni)
        .maybeSingle();

    if (existingLink) {
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

    // 4. Vincular participante
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

    console.log(`[ET5] AGREGAR_PERSONA: vinculado OK id=${linkData.id}`);
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

    // v2: payload.tipo_certificado (directo del schema)
    // v1 fallback: parsear de campo/valor/descripcion
    let tipoCert = payload.tipo_certificado || null;

    if (!tipoCert || !tiposValidos.includes(tipoCert)) {
        // Fallback: intentar parsear
        const desc = (payload.descripcion || payload.campo || payload.valor || "").toLowerCase();
        if (desc.includes("dominio")) tipoCert = "DOMINIO";
        else if (desc.includes("inhibici")) tipoCert = "INHIBICION";
        else if (desc.includes("catastral") || desc.includes("catastro")) tipoCert = "CATASTRAL";
        else if (desc.includes("municipal")) tipoCert = "DEUDA_MUNICIPAL";
        else if (desc.includes("arba")) tipoCert = "DEUDA_ARBA";
        else if (desc.includes("renta")) tipoCert = "RENTAS";
        else if (desc.includes("afip")) tipoCert = "AFIP";
        else if (desc.includes("anotaciones")) tipoCert = "ANOTACIONES_PERSONALES";
        else tipoCert = "OTRO";
    }

    // Idempotencia
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
