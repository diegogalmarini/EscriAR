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
import { SUPPORTED_ACT_TYPES } from "@/app/actions/modelos-types";

export interface ApplyContext {
    carpetaId: string;
    orgId: string;
    userId: string;
    evidenciaTexto?: string;
    /** Si true, permite sobreescribir nombre de persona existente (requiere confirmación previa del usuario) */
    forceUpdateName?: boolean;
    /** Si true, vincula persona existente sin verificar conflicto de nombre */
    keepExistingName?: boolean;
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

/**
 * Obtiene la operación de la escritura TRAMITE (operación activa del trámite).
 * NUNCA retorna operaciones de escrituras INGESTA (antecedente).
 * Si no hay TRAMITE, crea una automáticamente.
 */
async function getTramiteOperacion(supabase: SupabaseClient, carpetaId: string) {
    // 1. Buscar escritura TRAMITE
    let { data: escritura, error: escErr } = await supabase
        .from("escrituras")
        .select("id, source")
        .eq("carpeta_id", carpetaId)
        .eq("source", "TRAMITE")
        .limit(1)
        .maybeSingle();

    // 2. Si no existe TRAMITE, crearla (carpetas legacy pre-044)
    if (!escritura) {
        console.log(`[ET5] getTramiteOperacion: no hay TRAMITE para carpeta ${carpetaId}, creando...`);
        const { data: nueva, error: createErr } = await supabase
            .from("escrituras")
            .insert({ carpeta_id: carpetaId, source: "TRAMITE" })
            .select("id, source")
            .single();

        if (createErr || !nueva) {
            console.error(`[ET5] getTramiteOperacion: error creando TRAMITE`, createErr?.message);
            return null;
        }
        escritura = nueva;

        // Crear operación vacía
        const { error: opCreateErr } = await supabase
            .from("operaciones")
            .insert({ escritura_id: escritura.id, tipo_acto: "POR_DEFINIR" });

        if (opCreateErr) {
            console.error(`[ET5] getTramiteOperacion: error creando operación`, opCreateErr.message);
        }
    }

    // Guardrail: verificar que es TRAMITE
    if (escritura.source !== "TRAMITE") {
        console.error(`[ET5] GUARDRAIL: escritura ${escritura.id} tiene source=${escritura.source}, NO es TRAMITE. Rechazando.`);
        return null;
    }

    // 3. Obtener operación de la escritura TRAMITE
    const { data: operacion, error: opErr } = await supabase
        .from("operaciones")
        .select("id, monto_operacion, tipo_acto, codigo")
        .eq("escritura_id", escritura.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

    if (opErr || !operacion) {
        console.log(`[ET5] getTramiteOperacion: no operación para escritura TRAMITE ${escritura.id}`, opErr?.message);
        return null;
    }

    console.log(`[ET5] getTramiteOperacion: operacion_id=${operacion.id} (source=TRAMITE)`);
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
    // v3: payload.nombre (pila), payload.apellido, payload.dni, payload.rol
    // v2 fallback: payload.nombre era nombre completo
    let apellido = payload.apellido || null;
    let nombrePila = payload.nombre || payload.valor || null;

    // Fallback: si no viene apellido separado, intentar extraerlo de descripcion
    // Formato típico: "Agregar a Jose Carlos Perez Gonzales como vendedor."
    if (!apellido && nombrePila && payload.descripcion) {
        const match = payload.descripcion.match(/[Aa]gregar\s+a\s+(.+?)\s+como\s+/i);
        if (match) {
            const fullName = match[1].trim();
            // Si la descripción tiene más palabras que el nombre de pila, la diferencia es el apellido
            if (fullName.toLowerCase().startsWith(nombrePila.toLowerCase()) && fullName.length > nombrePila.length + 1) {
                apellido = fullName.substring(nombrePila.length).trim();
                console.log(`[ET5] AGREGAR_PERSONA: apellido extraído de descripcion: "${apellido}"`);
            }
        }
    }

    // Formato DB: "APELLIDO, Nombre" si tenemos ambos, sino nombre completo
    const nombre = apellido && nombrePila
        ? `${apellido.toUpperCase()}, ${nombrePila}`
        : nombrePila;
    const rol = payload.rol || "PARTE";

    // DNI: primero del payload estructurado, luego parsear de evidencia/descripcion
    let dni = payload.dni || null;
    if (!dni && ctx.evidenciaTexto) dni = extractDni(ctx.evidenciaTexto);
    if (!dni && payload.descripcion) dni = extractDni(payload.descripcion);

    // Limpiar DNI: quitar puntos y espacios
    if (dni) dni = dni.replace(/[.\s-]/g, "");

    // Sin DNI → generar temporal para crear borrador
    if (!dni) {
        dni = `TEMP_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        console.log(`[ET5] AGREGAR_PERSONA: sin DNI, generando temporal="${dni}" para "${nombre}"`);
    }

    console.log(`[ET5] AGREGAR_PERSONA: nombre="${nombre}", dni="${dni}", rol="${rol}"`);

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
        // Conflicto de nombre: NO sobreescribir sin confirmación explícita
        if (nombre && nombre.toUpperCase() !== existing.nombre_completo?.toUpperCase() && !ctx.keepExistingName) {
            if (!ctx.forceUpdateName) {
                // Primera pasada: devolver conflicto para que UI pida confirmación
                return {
                    success: false,
                    applied_changes: {
                        conflicto: "NOMBRE_DIFERENTE",
                        dni,
                        nombre_existente: existing.nombre_completo,
                        nombre_apunte: nombre,
                        rol,
                    },
                    error: `El DNI ${dni} ya existe como "${existing.nombre_completo}". El apunte indica "${nombre}". Confirme cuál es correcto.`,
                };
            }
            // Segunda pasada: usuario confirmó, actualizar nombre
            const { error: updErr } = await supabase
                .from("personas")
                .update({ nombre_completo: nombre })
                .eq("dni", dni);
            if (updErr) {
                return { success: false, applied_changes: null, error: `Error actualizando nombre: ${updErr.message}` };
            }
            console.log(`[ET5] AGREGAR_PERSONA: nombre actualizado (confirmado) "${existing.nombre_completo}" → "${nombre}"`);
        }
    }

    // 2. Obtener operación activa (SOLO TRAMITE — nunca antecedente)
    const operacion = await getTramiteOperacion(supabase, ctx.carpetaId);
    if (!operacion) {
        return { success: false, applied_changes: null, error: "[ET5] GUARDRAIL: No se encontró operación TRAMITE en la carpeta. No se aplicará sobre antecedente." };
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
        const operacion = await getTramiteOperacion(supabase, ctx.carpetaId);
        if (!operacion) {
            return { success: false, applied_changes: null, error: "Sin operación en carpeta" };
        }

        // Validar tipo_acto contra lista de tipos soportados
        if (dbColumn === "tipo_acto") {
            const isValid = SUPPORTED_ACT_TYPES.some(t => t.value === valor);
            if (!isValid) {
                return {
                    success: false,
                    applied_changes: { campo: "tipo_acto", valor_intentado: valor },
                    error: `El tipo de acto "${valor}" no está en el sistema. Seleccione el tipo correcto en Mesa de Trabajo.`,
                };
            }
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
