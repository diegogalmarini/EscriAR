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
 *   TRAMITE_REQUERIDO:   { descripcion, tramite_url?, tramite_url_label?, tramite_jurisdiccion?, tramite_costo? }
 *
 * También soporta el formato v1 legacy (campo/valor genérico) con fallback.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { SUPPORTED_ACT_TYPES } from "@/app/actions/modelos-types";
import { categoriaForActType } from "@/app/actions/actuaciones-types";

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

type PresupuestoMoneda = "ARS" | "USD";

// ─── Dispatcher ───────────────────────────────────────────
const handlers: Record<string, Handler> = {
    AGREGAR_PERSONA: handleAgregarPersona,
    COMPLETAR_DATOS: handleCompletarDatos,
    AGREGAR_CERTIFICADO: handleAgregarCertificado,
    VERIFICAR_DATO: handleInformational,
    ACCION_REQUERIDA: handleInformational,
    TRAMITE_REQUERIDO: handleInformational,
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
 * USA supabaseAdmin para bypasear RLS y garantizar acceso.
 * NUNCA retorna operaciones de escrituras INGESTA (antecedente).
 * Si no hay TRAMITE, crea una automáticamente.
 */
async function getTramiteOperacion(_supabase: SupabaseClient, carpetaId: string) {
    // Usar ADMIN client para bypasear RLS — crítico para que funcione siempre
    const admin = supabaseAdmin;

    // 0. Debug: listar TODAS las escrituras de la carpeta
    const { data: allEscrituras } = await admin
        .from("escrituras")
        .select("id, source, created_at")
        .eq("carpeta_id", carpetaId);
    console.log(`[ET5] getTramiteOperacion: carpeta=${carpetaId}, escrituras=${JSON.stringify(allEscrituras)}`);

    // 1. Buscar escritura TRAMITE
    const { data: escritura, error: escErr } = await admin
        .from("escrituras")
        .select("id, source")
        .eq("carpeta_id", carpetaId)
        .eq("source", "TRAMITE")
        .limit(1)
        .maybeSingle();

    if (escErr) {
        console.error(`[ET5] getTramiteOperacion: ERROR buscando TRAMITE`, escErr.message);
    }

    // 2. Si no existe TRAMITE, crearla
    let tramiteEscritura = escritura;
    if (!tramiteEscritura) {
        console.log(`[ET5] getTramiteOperacion: NO HAY TRAMITE para carpeta ${carpetaId}, creando con admin...`);
        const { data: nueva, error: createErr } = await admin
            .from("escrituras")
            .insert({ carpeta_id: carpetaId, source: "TRAMITE" })
            .select("id, source")
            .single();

        if (createErr || !nueva) {
            console.error(`[ET5] getTramiteOperacion: ERROR creando TRAMITE`, createErr?.message);
            return null;
        }
        tramiteEscritura = nueva;

        const { error: opCreateErr } = await admin
            .from("operaciones")
            .insert({ escritura_id: tramiteEscritura.id, tipo_acto: "POR_DEFINIR" });

        if (opCreateErr) {
            console.error(`[ET5] getTramiteOperacion: ERROR creando operación`, opCreateErr.message);
        }
    }

    // Guardrail HARD: verificar source
    if (tramiteEscritura.source !== "TRAMITE") {
        console.error(`[ET5] ❌ GUARDRAIL HARD: escritura ${tramiteEscritura.id} source=${tramiteEscritura.source} ≠ TRAMITE. RECHAZANDO.`);
        return null;
    }

    // 3. Obtener operación de la escritura TRAMITE
    const { data: operacion, error: opErr } = await admin
        .from("operaciones")
        .select("id, monto_operacion, tipo_acto, codigo, escritura_id")
        .eq("escritura_id", tramiteEscritura.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

    if (opErr || !operacion) {
        console.error(`[ET5] getTramiteOperacion: no operación para TRAMITE ${tramiteEscritura.id}`, opErr?.message);
        return null;
    }

    // Guardrail DOUBLE CHECK: verificar que la operación realmente pertenece a TRAMITE
    const { data: checkEsc } = await admin
        .from("escrituras")
        .select("source")
        .eq("id", operacion.escritura_id)
        .single();

    if (checkEsc?.source !== "TRAMITE") {
        console.error(`[ET5] ❌ DOUBLE CHECK FAILED: operacion ${operacion.id} → escritura ${operacion.escritura_id} → source=${checkEsc?.source}`);
        return null;
    }

    console.log(`[ET5] ✅ getTramiteOperacion: operacion_id=${operacion.id}, escritura_id=${tramiteEscritura.id} (source=TRAMITE)`);
    return operacion;
}

function normalizeMoneda(raw: unknown): PresupuestoMoneda {
    const text = String(raw ?? "").toUpperCase();
    if (
        text.includes("USD") ||
        text.includes("U$S") ||
        text.includes("DOLAR") ||
        text.includes("DÓLAR")
    ) {
        return "USD";
    }
    return "ARS";
}

function parseMoneyValue(raw: unknown): number | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;

    const original = String(raw).trim();
    if (!original) return null;

    // Keep only digits, comma, dot and minus to parse locale variants.
    let cleaned = original.replace(/[^\d,.-]/g, "");
    const hasComma = cleaned.includes(",");
    const hasDot = cleaned.includes(".");

    if (hasComma && hasDot) {
        const lastComma = cleaned.lastIndexOf(",");
        const lastDot = cleaned.lastIndexOf(".");
        const decimalSep = lastComma > lastDot ? "," : ".";
        const thousandSep = decimalSep === "," ? "." : ",";
        cleaned = cleaned.split(thousandSep).join("");
        if (decimalSep === ",") {
            cleaned = cleaned.replace(",", ".");
        } else {
            cleaned = cleaned.replace(/,/g, "");
        }
    } else if (hasComma) {
        const commaParts = cleaned.split(",");
        const decimalCandidate = commaParts[commaParts.length - 1];
        if (decimalCandidate.length <= 2) {
            cleaned = cleaned.replace(/\./g, "").replace(",", ".");
        } else {
            cleaned = cleaned.replace(/,/g, "");
        }
    } else if (hasDot) {
        const dotParts = cleaned.split(".");
        const decimalCandidate = dotParts[dotParts.length - 1];
        if (decimalCandidate.length > 2) {
            cleaned = cleaned.replace(/\./g, "");
        }
    }

    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
}

function extractMonetaryFromPayload(payload: any, evidenciaTexto?: string): {
    monto: number | null;
    moneda: PresupuestoMoneda;
    cotizacionUsd: number | null;
} {
    const valorBruto = payload?.valor ?? payload?.monto ?? null;
    const monto = parseMoneyValue(valorBruto);

    const monedaRaw = payload?.moneda || payload?.currency || payload?.divisa || evidenciaTexto || "";
    const moneda = normalizeMoneda(monedaRaw);

    const cotizacionRaw = payload?.cotizacion_usd ?? payload?.tipo_cambio ?? payload?.exchangeRate ?? null;
    const cotizacionUsd = parseMoneyValue(cotizacionRaw);

    return { monto, moneda, cotizacionUsd };
}

async function upsertPresupuestoMontoFromSuggestion(ctx: ApplyContext, data: {
    monto: number;
    moneda: PresupuestoMoneda;
    cotizacionUsd: number | null;
    tipoActo: string | null;
    codigoActo: string | null;
}): Promise<{ presupuestoId: string; version: number; accion: "insert" | "update" }> {
    const { data: lastPresupuesto, error: lastErr } = await supabaseAdmin
        .from("presupuestos")
        .select("id, version")
        .eq("carpeta_id", ctx.carpetaId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (lastErr) {
        throw new Error(`Error consultando presupuesto actual: ${lastErr.message}`);
    }

    const common = {
        monto_operacion: data.monto,
        moneda: data.moneda,
        cotizacion_usd: data.moneda === "USD" ? data.cotizacionUsd : null,
        tipo_acto: data.tipoActo,
        codigo_acto: data.codigoActo,
    };

    if (lastPresupuesto?.id) {
        const { error: updErr } = await supabaseAdmin
            .from("presupuestos")
            .update(common)
            .eq("id", lastPresupuesto.id);

        if (updErr) {
            throw new Error(`Error actualizando presupuesto: ${updErr.message}`);
        }

        return { presupuestoId: lastPresupuesto.id, version: lastPresupuesto.version, accion: "update" };
    }

    const { data: inserted, error: insErr } = await supabaseAdmin
        .from("presupuestos")
        .insert({
            carpeta_id: ctx.carpetaId,
            org_id: ctx.orgId,
            version: 1,
            ...common,
        })
        .select("id, version")
        .single();

    if (insErr || !inserted) {
        throw new Error(`Error creando presupuesto: ${insErr?.message || "insert failed"}`);
    }

    return { presupuestoId: inserted.id, version: inserted.version, accion: "insert" };
}

/** Intenta extraer un DNI de un texto (fallback para payloads v1 legacy) */
function extractDni(text: string): string | null {
    const match = text.match(/(?:DNI|D\.N\.I\.?|documento)\s*(?:N[°ºo]?\s*)?(\d{1,3}[.\s]?\d{3}[.\s]?\d{3})/i);
    if (match) return match[1].replace(/[.\s]/g, "");
    const digits = text.match(/\b(\d{7,8})\b/);
    return digits ? digits[1] : null;
}

/**
 * Buscar persona en participantes del antecedente (INGESTA) por coincidencia de nombre.
 * Si el apunte menciona "CIMINELLI" y en el antecedente hay "CIMINELLI, Jorge Gustavo"
 * con DNI completo, reutilizamos ese DNI en vez de crear persona fantasma.
 */
async function findPersonInAntecedente(carpetaId: string, nombre: string): Promise<string | null> {
    // Extraer apellido para búsqueda flexible
    const nameUpper = nombre.toUpperCase();
    const apellidoPart = nombre.includes(",")
        ? nombre.split(",")[0].trim().toUpperCase()
        : (nombre.split(/\s+/).pop() || "").toUpperCase();

    if (apellidoPart.length < 3) return null;

    // Buscar participantes en escrituras INGESTA de esta carpeta
    const { data: ingestaParticipants } = await supabaseAdmin
        .from("escrituras")
        .select(`
            operaciones (
                participantes_operacion (
                    persona_id,
                    personas:persona_id ( dni, nombre_completo )
                )
            )
        `)
        .eq("carpeta_id", carpetaId)
        .eq("source", "INGESTA");

    if (!ingestaParticipants) return null;

    // Flatten nested structure
    const personas: { dni: string; nombre_completo: string }[] = [];
    for (const esc of ingestaParticipants) {
        for (const op of (esc as any).operaciones || []) {
            for (const po of op.participantes_operacion || []) {
                if (po.personas?.dni && po.personas?.nombre_completo) {
                    personas.push(po.personas);
                }
            }
        }
    }

    // Buscar match por apellido
    const match = personas.find(p => {
        const pName = p.nombre_completo.toUpperCase();
        return pName.includes(apellidoPart) || nameUpper.includes(pName.split(",")[0]?.trim() || "___");
    });

    if (match && !match.dni.startsWith("TEMP_") && !match.dni.startsWith("SIN_DNI")) {
        console.log(`[ET5] findPersonInAntecedente: match "${nombre}" → "${match.nombre_completo}" (DNI ${match.dni})`);
        return match.dni;
    }

    return null;
}

/**
 * Cross-check: cuando se agrega un VENDEDOR en TRAMITE, verificar si coincide
 * con el titular (COMPRADOR/ADQUIRENTE) del antecedente INGESTA.
 * Si no coincide, crea una sugerencia VERIFICAR_DATO automática.
 */
async function crossCheckTitularidad(
    carpetaId: string,
    orgId: string,
    vendedorDni: string,
    vendedorNombre: string
): Promise<void> {
    try {
        // Buscar titulares en INGESTA (el COMPRADOR del antecedente = actual propietario)
        const { data: ingestaEscs } = await supabaseAdmin
            .from("escrituras")
            .select(`
                operaciones (
                    participantes_operacion (
                        rol,
                        persona_id,
                        personas:persona_id ( dni, nombre_completo )
                    )
                )
            `)
            .eq("carpeta_id", carpetaId)
            .eq("source", "INGESTA");

        if (!ingestaEscs || ingestaEscs.length === 0) return;

        const ROLES_TITULAR = ["COMPRADOR", "ADQUIRENTE", "DONATARIO", "CESIONARIO"];
        const titulares: { dni: string; nombre: string }[] = [];

        for (const esc of ingestaEscs) {
            for (const op of (esc as any).operaciones || []) {
                for (const po of op.participantes_operacion || []) {
                    if (ROLES_TITULAR.includes(po.rol?.toUpperCase() || "") && po.personas?.dni) {
                        titulares.push({ dni: po.personas.dni, nombre: po.personas.nombre_completo || "" });
                    }
                }
            }
        }

        if (titulares.length === 0) return;

        // ¿El vendedor coincide con algún titular?
        const vendedorApellido = vendedorNombre.toUpperCase().includes(",")
            ? vendedorNombre.toUpperCase().split(",")[0].trim()
            : (vendedorNombre.toUpperCase().split(/\s+/).pop() || "");

        const coincide = titulares.some(t =>
            t.dni === vendedorDni ||
            t.nombre.toUpperCase().includes(vendedorApellido) ||
            vendedorApellido.length > 2 && vendedorNombre.toUpperCase().includes(
                t.nombre.toUpperCase().includes(",") ? t.nombre.toUpperCase().split(",")[0].trim() : ""
            )
        );

        if (coincide) {
            console.log(`[ET5] Cross-check: vendedor "${vendedorNombre}" coincide con titular del antecedente ✅`);
            return;
        }

        // No coincide → crear sugerencia VERIFICAR_DATO
        const titularesStr = titulares.map(t => t.nombre).join(", ");
        console.log(`[ET5] ⚠️ Cross-check: vendedor "${vendedorNombre}" NO coincide con titulares [${titularesStr}]`);

        // Verificar que no exista ya una sugerencia similar
        const { data: existingSug } = await supabaseAdmin
            .from("sugerencias")
            .select("id")
            .eq("carpeta_id", carpetaId)
            .eq("tipo", "VERIFICAR_DATO")
            .ilike("payload->>descripcion", `%titularidad%${vendedorApellido}%`)
            .limit(1);

        if (existingSug && existingSug.length > 0) return; // Ya existe

        await supabaseAdmin.from("sugerencias").insert({
            org_id: orgId,
            carpeta_id: carpetaId,
            tipo: "VERIFICAR_DATO",
            estado: "PROPOSED",
            confianza: 0.95,
            payload: {
                descripcion: `Discrepancia de titularidad: ${vendedorNombre} figura como vendedor pero el titular según el antecedente es ${titularesStr}. Verifique que el antecedente sea correcto o que el vendedor sea quien corresponde.`,
                campo: "titularidad",
                vendedor: vendedorNombre,
                vendedor_dni: vendedorDni,
                titulares_antecedente: titulares,
            },
            evidencia_texto: `Vendedor: ${vendedorNombre} (DNI ${vendedorDni}). Titulares antecedente: ${titularesStr}.`,
        });

        console.log(`[ET5] ✅ Sugerencia VERIFICAR_DATO creada para discrepancia de titularidad`);
    } catch (err: any) {
        console.error(`[ET5] Error en crossCheckTitularidad:`, err.message);
        // No bloquear la operación principal por un error de cross-check
    }
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

    // Sin DNI → buscar en antecedente (INGESTA) por coincidencia de nombre
    if (!dni && nombre) {
        const foundDni = await findPersonInAntecedente(ctx.carpetaId, nombre);
        if (foundDni) {
            dni = foundDni;
            console.log(`[ET5] AGREGAR_PERSONA: DNI encontrado en antecedente="${dni}" para "${nombre}"`);
        }
    }

    // Sin DNI → buscar en tabla personas global por nombre
    if (!dni && nombre) {
        const nameUpper = nombre.toUpperCase();
        // Buscar por apellido (primera palabra antes de coma, o última palabra)
        const apellidoBuscar = nombre.includes(",")
            ? nombre.split(",")[0].trim().toUpperCase()
            : (apellido || nombre.split(/\s+/).pop() || "").toUpperCase();

        if (apellidoBuscar.length > 2) {
            const { data: candidates } = await supabaseAdmin
                .from("personas")
                .select("dni, nombre_completo")
                .ilike("nombre_completo", `%${apellidoBuscar}%`)
                .limit(5);

            if (candidates && candidates.length === 1) {
                // Match único por apellido → usar ese DNI
                dni = candidates[0].dni;
                console.log(`[ET5] AGREGAR_PERSONA: match único global por apellido "${apellidoBuscar}" → dni=${dni} (${candidates[0].nombre_completo})`);
            } else if (candidates && candidates.length > 1) {
                // Multiples matches → intentar match exacto
                const exact = candidates.find(c =>
                    c.nombre_completo?.toUpperCase() === nameUpper ||
                    c.nombre_completo?.toUpperCase().includes(nameUpper) ||
                    nameUpper.includes(c.nombre_completo?.toUpperCase() || "")
                );
                if (exact) {
                    dni = exact.dni;
                    console.log(`[ET5] AGREGAR_PERSONA: match exacto global "${nombre}" → dni=${dni}`);
                }
            }
        }
    }

    // Sin DNI → generar temporal como último recurso
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

    // 3. Idempotencia: verificar si ya está vinculado (usar admin)
    const { data: existingLink } = await supabaseAdmin
        .from("participantes_operacion")
        .select("id")
        .eq("operacion_id", operacion.id)
        .eq("persona_id", dni)
        .maybeSingle();

    if (existingLink) {
        console.log(`[ET5] AGREGAR_PERSONA: ya vinculado, operacion_id=${operacion.id}, dni=${dni}`);
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

    // 4. Vincular participante (usar admin para bypasear RLS)
    console.log(`[ET5] AGREGAR_PERSONA: INSERTANDO en operacion_id=${operacion.id} (TRAMITE), dni=${dni}, rol=${rol}`);
    const { data: linkData, error: linkErr } = await supabaseAdmin
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

    // 5. Cross-check titularidad: si es VENDEDOR, verificar contra antecedente
    const ROLES_VENDEDOR = ["VENDEDOR", "TRANSMITENTE", "DONANTE", "CEDENTE"];
    if (ROLES_VENDEDOR.includes(rol.toUpperCase())) {
        await crossCheckTitularidad(ctx.carpetaId, ctx.orgId, dni, nombre || existing?.nombre_completo || "");
    }

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
        precio: "monto_operacion",
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

        if (dbColumn === "monto_operacion") {
            const parsed = extractMonetaryFromPayload(payload, ctx.evidenciaTexto);
            if (parsed.monto === null) {
                return {
                    success: false,
                    applied_changes: null,
                    error: `No se pudo interpretar monto_operacion desde valor=${String(valor)}`,
                };
            }

            const sync = await upsertPresupuestoMontoFromSuggestion(ctx, {
                monto: parsed.monto,
                moneda: parsed.moneda,
                cotizacionUsd: parsed.cotizacionUsd,
                tipoActo: operacion.tipo_acto || null,
                codigoActo: operacion.codigo || null,
            });

            return {
                success: true,
                applied_changes: {
                    tabla: "presupuestos",
                    accion: sync.accion,
                    presupuesto_id: sync.presupuestoId,
                    version: sync.version,
                    campo: "monto_operacion",
                    valor_nuevo: parsed.monto,
                    moneda: parsed.moneda,
                    cotizacion_usd: parsed.moneda === "USD" ? parsed.cotizacionUsd : null,
                    valor_anterior_operacion: (operacion as any).monto_operacion,
                    nota: "monto_operacion desde Apuntes se sincroniza en Presupuesto (fuente de verdad)",
                },
            };
        }

        const updateData: Record<string, any> = {};
        updateData[dbColumn] = valor;

        // Auto-setear código CESBA cuando se define tipo_acto
        if (dbColumn === "tipo_acto") {
            const TIPO_ACTO_TO_CODIGO: Record<string, string> = {
                compraventa: "100-00",
                venta_anexion: "100-10",
                hipoteca: "300-00",
                cancelacion_hipoteca: "311-00",
                donacion: "200-30",
                donacion_dineraria: "200-31",
                donacion_usufructo: "200-32",
                donacion_reversion_usufructo: "200-32",
                cesion_derechos: "100-51",
                distracto_condominio: "100-20",
            };
            const codigoDefault = TIPO_ACTO_TO_CODIGO[valor];
            if (codigoDefault) {
                updateData["codigo"] = codigoDefault;
            }
        }

        console.log(`[ET5] COMPLETAR_DATOS: actualizando operacion_id=${operacion.id} (TRAMITE), ${dbColumn}=${updateData[dbColumn]}`);
        const { error } = await supabaseAdmin
            .from("operaciones")
            .update(updateData)
            .eq("id", operacion.id);

        if (error) {
            return { success: false, applied_changes: null, error: `Error actualizando operación: ${error.message}` };
        }

        // Auto-crear actuación cuando se setea tipo_acto
        let actuacion_creada: string | null = null;
        if (dbColumn === "tipo_acto" && valor) {
            const catRaw = categoriaForActType(valor);
            const categoria = (catRaw === "AMBIGUO" || catRaw === "HIDDEN") ? "PROTOCOLAR" : catRaw;
            // Verificar que no exista ya una actuación con este act_type
            const { data: existing } = await supabaseAdmin
                .from("actuaciones")
                .select("id")
                .eq("carpeta_id", ctx.carpetaId)
                .eq("act_type", valor)
                .limit(1);

            if (!existing || existing.length === 0) {
                const { data: newAct, error: actErr } = await supabaseAdmin
                    .from("actuaciones")
                    .insert({
                        org_id: ctx.orgId,
                        carpeta_id: ctx.carpetaId,
                        operacion_id: operacion.id,
                        categoria,
                        act_type: valor,
                        status: "DRAFT",
                        created_by: ctx.userId,
                    })
                    .select("id")
                    .single();

                if (actErr) {
                    console.error(`[ET5] Error auto-creando actuación: ${actErr.message}`);
                } else {
                    actuacion_creada = newAct.id;
                    console.log(`[ET5] ✅ Auto-creada actuación ${categoria} "${valor}" id=${newAct.id}`);
                }
            } else {
                console.log(`[ET5] Actuación "${valor}" ya existe para carpeta, skip auto-creación`);
            }
        }

        return {
            success: true,
            applied_changes: {
                tabla: "operaciones",
                operacion_id: operacion.id,
                campo: dbColumn,
                valor_nuevo: updateData[dbColumn],
                valor_anterior: (operacion as any)[dbColumn],
                ...(actuacion_creada ? { actuacion_creada, actuacion_categoria: categoriaForActType(valor) } : {}),
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
