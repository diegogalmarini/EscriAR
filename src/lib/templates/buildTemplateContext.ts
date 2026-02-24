/**
 * buildTemplateContext.ts
 *
 * Transforma los datos de una carpeta NotiAR en el formato JSON
 * que esperan los templates DOCX Jinja2 del Template Builder.
 *
 * Uso: buildTemplateContext(carpetaId) → { escritura, vendedores[], compradores[], ... }
 *
 * El objeto devuelto se pasa directamente a docxtpl para renderizar el DOCX.
 * Los field_name del sample_metadata.json son las keys exactas de este context.
 */

import { createClient } from "@/lib/supabaseServer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Persona con todos los campos que persiste la BD */
interface PersonaDB {
    dni: string;
    cuit: string | null;
    nombre_completo: string;
    tipo_persona: "FISICA" | "JURIDICA" | "FIDEICOMISO";
    nacionalidad: string | null;
    fecha_nacimiento: string | null;
    estado_civil_detalle: string | null;
    domicilio_real: { literal?: string } | null;
    datos_conyuge: {
        nombre_completo?: string;
        dni?: string;
        cuit?: string;
    } | null;
    profesion: string | null;
    regimen_patrimonial: string | null;
    nro_documento_conyugal: string | null;
    cuit_tipo: string | null;
}

interface ParticipanteDB {
    id: string;
    rol: string;
    porcentaje_titularidad: number | null;
    datos_representacion: {
        representa_a?: string;
        caracter?: string;
        poder_detalle?: string;
    } | null;
    personas: PersonaDB;
}

interface OperacionDB {
    id: string;
    tipo_acto: string;
    monto_operacion: number | null;
    codigo: string | null;
    participantes_operacion: ParticipanteDB[];
}

interface InmuebleDB {
    id: string;
    partido_id: string | null;
    nro_partida: string | null;
    nomenclatura: string | null;
    transcripcion_literal: string | null;
    titulo_antecedente: string | null;
    valuacion_fiscal: number | null;
}

interface CertificadoDB {
    id: string;
    tipo: string;
    estado: string;
    nro_certificado: string | null;
    fecha_recepcion: string | null;
    fecha_vencimiento: string | null;
    observaciones: string | null;
}

interface EscribanoDB {
    nombre_completo: string;
    caracter: string;
    genero_titulo: string | null;
    numero_registro: string;
    distrito_notarial: string;
    matricula: string | null;
    cuit: string | null;
    domicilio_legal: string | null;
}

// ---------------------------------------------------------------------------
// Template context types (output — matches Jinja2 tags)
// ---------------------------------------------------------------------------

interface PersonaTemplate {
    nombre_completo: string;
    tipo_documento: string;
    numero_documento: string;
    nacionalidad: string;
    estado_civil: string;
    domicilio: string;
    cuit_cuil: string;
    fecha_nacimiento: string;
    profesion: string;
}

interface ConyugeTemplate {
    nombre_completo: string;
    tipo_documento: string;
    numero_documento: string;
    nacionalidad: string;
    estado_civil: string;
    domicilio: string;
}

interface EscrituraTemplate {
    numero: string;
    fecha: string;
    escribano: string;
    registro: string;
    caracter: string;
    distrito: string;
    folio: string;
    tomo: string;
    localidad: string;
    provincia: string;
}

interface InmuebleTemplate {
    descripcion_legal: string;
    matricula: string;
    partida_fiscal: string;
    nomenclatura_catastral: string;
    superficie_terreno: string;
    superficie_cubierta: string;
    ubicacion_calle: string;
    ubicacion_localidad: string;
    ubicacion_partido: string;
    ubicacion_provincia: string;
    linderos_norte: string;
    linderos_sur: string;
    linderos_este: string;
}

interface TituloAntecedenteTemplate {
    escritura_numero: string;
    escribano_autorizante: string;
    fecha: string;
    registro: string;
    folio: string;
    tomo: string;
    matricula: string;
}

interface OperacionTemplate {
    precio_venta: string;
    precio_letras: string;
    moneda: string;
    forma_pago: string;
    plazo_pago: string;
}

interface CertificadosTemplate {
    dominio_numero: string;
    dominio_fecha: string;
    inhibiciones_numero: string;
    inhibiciones_fecha: string;
    catastro_numero: string;
    deuda_municipal: string;
    deuda_arba: string;
}

interface ImpuestosTemplate {
    base_imponible: string;
    sellados: string;
    iti: string;
}

interface ApoderadoTemplate extends PersonaTemplate {
    // mismos campos que persona
}

interface PoderDatosTemplate {
    tipo_poder: string;
    escritura_poder: string;
    escribano_poder: string;
    registro_poder: string;
    facultades: string;
}

interface PersonaJuridicaTemplate {
    razon_social: string;
    cuit: string;
    tipo_sociedad: string;
    inscripcion_igj: string;
    sede_social: string;
    representante_legal: string;
    cargo_representante: string;
}

export interface TemplateContext {
    escritura: EscrituraTemplate;
    vendedores: PersonaTemplate[];
    compradores: PersonaTemplate[];
    conyuge: ConyugeTemplate;
    apoderado: ApoderadoTemplate;
    inmueble: InmuebleTemplate;
    titulo_antecedente: TituloAntecedenteTemplate;
    operacion: OperacionTemplate;
    certificados: CertificadosTemplate;
    impuestos: ImpuestosTemplate;
    poder_datos: PoderDatosTemplate;
    persona_juridica: PersonaJuridicaTemplate;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY = "";

function formatDateNotarial(dateStr: string | null): string {
    if (!dateStr) return EMPTY;
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString("es-AR", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    } catch {
        return dateStr;
    }
}

function mapPersona(p: PersonaDB): PersonaTemplate {
    return {
        nombre_completo: p.nombre_completo || EMPTY,
        tipo_documento: "DNI",
        numero_documento: p.dni || EMPTY,
        nacionalidad: p.nacionalidad || "argentina",
        estado_civil: p.estado_civil_detalle || EMPTY,
        domicilio: p.domicilio_real?.literal || EMPTY,
        cuit_cuil: p.cuit || EMPTY,
        fecha_nacimiento: formatDateNotarial(p.fecha_nacimiento),
        profesion: p.profesion || EMPTY,
    };
}

/** Encuentra el primer participante cuyo rol incluya algún keyword */
function findByRol(participantes: ParticipanteDB[], ...keywords: string[]): ParticipanteDB | undefined {
    return participantes.find((p) =>
        keywords.some((k) => p.rol?.toUpperCase().includes(k))
    );
}

/** Filtra participantes cuyo rol incluya algún keyword */
function filterByRol(participantes: ParticipanteDB[], ...keywords: string[]): ParticipanteDB[] {
    return participantes.filter((p) =>
        keywords.some((k) => p.rol?.toUpperCase().includes(k))
    );
}

function findCert(certs: CertificadoDB[], tipo: string): CertificadoDB | undefined {
    return certs.find((c) => c.tipo === tipo);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function buildTemplateContext(carpetaId: string): Promise<TemplateContext> {
    const supabase = await createClient();

    // 1. Fetch deep carpeta data
    const { data: carpeta, error: carpetaError } = await supabase
        .from("carpetas")
        .select(`
            *,
            escrituras (
                *,
                inmuebles (*),
                operaciones (
                    *,
                    participantes_operacion (
                        *,
                        personas (*)
                    )
                )
            )
        `)
        .eq("id", carpetaId)
        .single();

    if (carpetaError || !carpeta) {
        throw new Error(`No se pudo obtener carpeta ${carpetaId}: ${carpetaError?.message}`);
    }

    // 2. Fetch certificados
    const { data: certificados } = await supabase
        .from("certificados")
        .select("*")
        .eq("carpeta_id", carpetaId);

    const certs: CertificadoDB[] = certificados || [];

    // 3. Fetch escribano (default)
    const { data: escribano } = await supabase
        .from("escribanos")
        .select("*")
        .eq("is_default", true)
        .single();

    // 4. Extract nested data
    const escritura = carpeta.escrituras?.[0];
    const operacion: OperacionDB | undefined = escritura?.operaciones?.[0];
    const inmueble: InmuebleDB | undefined = escritura?.inmuebles;
    const participantes: ParticipanteDB[] = operacion?.participantes_operacion || [];

    // 5. Classify participants by role
    const vendedoresDB = filterByRol(participantes, "VENDEDOR", "TRANSMITENTE", "CEDENTE", "DONANTE");
    const compradoresDB = filterByRol(participantes, "COMPRADOR", "ADQUIRENTE", "CESIONARIO", "DONATARIO");
    const apoderadoDB = findByRol(participantes, "APODERADO", "REPRESENTANTE");

    // 6. Build conyuge from vendedor's datos_conyuge
    const vendedorPrincipal = vendedoresDB[0]?.personas;
    const conyugeData = vendedorPrincipal?.datos_conyuge;

    // 7. Detect persona jurídica among participants
    const personaJuridica = participantes.find(
        (p) => p.personas?.tipo_persona === "JURIDICA" || p.personas?.tipo_persona === "FIDEICOMISO"
    );

    // 8. Build the context object matching Jinja2 tags exactly
    const context: TemplateContext = {
        // --- escritura ---
        escritura: {
            numero: escritura?.nro_protocolo?.toString() || EMPTY,
            fecha: formatDateNotarial(escritura?.fecha_escritura),
            escribano: escribano?.nombre_completo || EMPTY,
            registro: escribano?.numero_registro ? `Registro Notarial Nro. ${escribano.numero_registro}` : EMPTY,
            caracter: escribano?.caracter?.toLowerCase().replace("_", " ") || "titular",
            distrito: escribano?.distrito_notarial || EMPTY,
            folio: EMPTY, // se completa al momento de autorizar
            tomo: EMPTY,  // se completa al momento de autorizar
            localidad: escribano?.distrito_notarial || EMPTY,
            provincia: "Buenos Aires",
        },

        // --- vendedores ---
        vendedores: vendedoresDB.map((p) => mapPersona(p.personas)),

        // --- compradores ---
        compradores: compradoresDB.map((p) => mapPersona(p.personas)),

        // --- cónyuge (asentimiento conyugal Art. 456 CCyCN) ---
        conyuge: {
            nombre_completo: conyugeData?.nombre_completo || EMPTY,
            tipo_documento: "DNI",
            numero_documento: conyugeData?.dni || vendedorPrincipal?.nro_documento_conyugal || EMPTY,
            nacionalidad: "argentina",
            estado_civil: vendedorPrincipal?.estado_civil_detalle || EMPTY,
            domicilio: vendedorPrincipal?.domicilio_real?.literal || EMPTY,
        },

        // --- apoderado ---
        apoderado: apoderadoDB
            ? mapPersona(apoderadoDB.personas)
            : {
                nombre_completo: EMPTY,
                tipo_documento: EMPTY,
                numero_documento: EMPTY,
                nacionalidad: EMPTY,
                estado_civil: EMPTY,
                domicilio: EMPTY,
                cuit_cuil: EMPTY,
                fecha_nacimiento: EMPTY,
                profesion: EMPTY,
            },

        // --- inmueble (campos estructurados) ---
        inmueble: {
            descripcion_legal: inmueble?.transcripcion_literal || EMPTY,
            matricula: EMPTY, // no lo persiste la BD como campo separado aún
            partida_fiscal: inmueble?.nro_partida || EMPTY,
            nomenclatura_catastral: inmueble?.nomenclatura || EMPTY,
            superficie_terreno: EMPTY, // extraer de transcripcion_literal a futuro
            superficie_cubierta: EMPTY,
            ubicacion_calle: inmueble?.nomenclatura || EMPTY,
            ubicacion_localidad: inmueble?.partido_id || EMPTY,
            ubicacion_partido: inmueble?.partido_id || EMPTY,
            ubicacion_provincia: "Buenos Aires",
            linderos_norte: EMPTY,
            linderos_sur: EMPTY,
            linderos_este: EMPTY,
        },

        // --- título antecedente ---
        titulo_antecedente: {
            escritura_numero: EMPTY,
            escribano_autorizante: EMPTY,
            fecha: EMPTY,
            registro: EMPTY,
            folio: EMPTY,
            tomo: EMPTY,
            matricula: EMPTY,
            // Nota: el campo inmuebles.titulo_antecedente contiene el texto completo
            // del tracto. A futuro la IA lo puede descomponer en campos estructurados.
        },

        // --- operación ---
        operacion: {
            precio_venta: operacion?.monto_operacion
                ? `$${operacion.monto_operacion.toLocaleString("es-AR")}`
                : EMPTY,
            precio_letras: EMPTY, // requiere conversión num→letras
            moneda: "pesos",
            forma_pago: EMPTY, // no persiste en BD aún
            plazo_pago: EMPTY,
        },

        // --- certificados ---
        certificados: {
            dominio_numero: findCert(certs, "DOMINIO")?.nro_certificado || EMPTY,
            dominio_fecha: formatDateNotarial(findCert(certs, "DOMINIO")?.fecha_recepcion || null),
            inhibiciones_numero: findCert(certs, "INHIBICION")?.nro_certificado || EMPTY,
            inhibiciones_fecha: formatDateNotarial(findCert(certs, "INHIBICION")?.fecha_recepcion || null),
            catastro_numero: findCert(certs, "CATASTRAL")?.nro_certificado || EMPTY,
            deuda_municipal: findCert(certs, "DEUDA_MUNICIPAL")?.observaciones || EMPTY,
            deuda_arba: findCert(certs, "DEUDA_ARBA")?.observaciones || EMPTY,
        },

        // --- impuestos ---
        impuestos: {
            base_imponible: EMPTY, // se calcula con taxCalculator
            sellados: EMPTY,
            iti: EMPTY,
        },

        // --- poder_datos ---
        poder_datos: {
            tipo_poder: apoderadoDB?.datos_representacion?.caracter || EMPTY,
            escritura_poder: EMPTY, // no persiste aún como campo separado
            escribano_poder: EMPTY,
            registro_poder: EMPTY,
            facultades: apoderadoDB?.datos_representacion?.poder_detalle || EMPTY,
        },

        // --- persona jurídica ---
        persona_juridica: {
            razon_social: personaJuridica?.personas?.nombre_completo || EMPTY,
            cuit: personaJuridica?.personas?.cuit || EMPTY,
            tipo_sociedad: EMPTY, // no persiste en BD
            inscripcion_igj: EMPTY,
            sede_social: personaJuridica?.personas?.domicilio_real?.literal || EMPTY,
            representante_legal: personaJuridica?.datos_representacion?.representa_a
                ? personaJuridica.datos_representacion.representa_a
                : EMPTY,
            cargo_representante: personaJuridica?.datos_representacion?.caracter || EMPTY,
        },
    };

    return context;
}
