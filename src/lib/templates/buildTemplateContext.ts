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
import { priceToSpanishWords } from "./numberToWords";

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

interface PresupuestoDB {
    monto_operacion: number | null;
    moneda: string | null;
    version: number;
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
    // --- Alias Template Builder ---
    localidad_otorgamiento: string;
    distrito_notarial: string;
    tipo_acto: string;
    partido: string;
    fecha_dia_letras: string;
    fecha_mes_letras: string;
    fecha_anio_letras: string;
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
    partido_code: string;
    delegacion_code: string;
    ubicacion_provincia: string;
    linderos_norte: string;
    linderos_sur: string;
    linderos_este: string;
    // --- Alias Template Builder ---
    descripcion: string;
    partida_inmobiliaria: string;
    partido: string;
    circunscripcion: string;
    seccion: string;
    quinta: string;
    manzana: string;
    parcela: string;
    subparcela: string;
    porcentaje_copropiedad: string;
}

interface TituloAntecedenteTemplate {
    escritura_numero: string;
    escribano_autorizante: string;
    fecha: string;
    registro: string;
    folio: string;
    tomo: string;
    matricula: string;
    // --- Alias Template Builder ---
    tipo_acto: string;
}

interface OperacionTemplate {
    precio_venta: string;
    precio_letras: string;
    moneda: string;
    forma_pago: string;
    plazo_pago: string;
    // --- Alias Template Builder ---
    precio_total: string;
    precio_numeros: string;
    senia: string;
    saldo: string;
    valuacion_fiscal: string;
    valuacion_fiscal_acto: string;
}

interface CurrencyMeta {
    labelUpper: string;
    labelLower: string;
    symbol: string;
}

function normalizeCurrencyMeta(monedaRaw: string | null | undefined): CurrencyMeta {
    const moneda = (monedaRaw || "ARS").toUpperCase().trim();
    if (moneda === "USD" || moneda === "U$S" || moneda === "DOLAR" || moneda === "DÓLAR") {
        return {
            labelUpper: "DÓLARES ESTADOUNIDENSES",
            labelLower: "dólares estadounidenses",
            symbol: "U$S",
        };
    }
    return {
        labelUpper: "PESOS",
        labelLower: "pesos",
        symbol: "$",
    };
}

function formatMoney(amount: number, symbol: string): string {
    return `${symbol} ${amount.toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

interface CertificadosTemplate {
    dominio_numero: string;
    dominio_fecha: string;
    inhibiciones_numero: string;
    inhibiciones_fecha: string;
    catastro_numero: string;
    deuda_municipal: string;
    deuda_arba: string;
    // --- Alias Template Builder ---
    catastro: string;
    inhibiciones: string;
    fecha_registro_propiedad: string;
}

interface ImpuestosTemplate {
    base_imponible: string;
    sellados: string;
    iti: string;
    // --- Alias Template Builder ---
    iti_monto: string;
    ganancias: string;
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
    // --- Alias Template Builder ---
    domicilio_legal: string;
    representante_nombre: string;
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

    // ── Role aliases for act-type-specific templates ──
    // These are synonyms pointing to the same underlying participant data.
    // The Template Builder generates placeholders like {{ donantes[0].nombre_completo }}
    // which docxtpl resolves from these keys.
    donantes: PersonaTemplate[];
    donatarios: PersonaTemplate[];
    donante: PersonaTemplate;
    cedentes: PersonaTemplate[];
    cesionarios: PersonaTemplate[];
    transmitentes: PersonaTemplate[];
    adquirentes: PersonaTemplate[];
    poderdantes: PersonaTemplate[];
    apoderados: PersonaTemplate[];
    requirente: PersonaTemplate;
    requirentes: PersonaTemplate[];
    comparecientes: PersonaTemplate[];
    autorizados: PersonaTemplate[];
    permutantes: PersonaTemplate[];
    beneficiarios: PersonaTemplate[];
    usufructuantes: PersonaTemplate[];
    usufructuarios: PersonaTemplate[];
    partes: PersonaTemplate[];
    otros_comparecientes: PersonaTemplate[];
    acreedor: PersonaTemplate;
    deudor: PersonaTemplate;
    causante: PersonaTemplate;
    apoderado_vendedor: PersonaTemplate;
    apoderado_comprador: PersonaTemplate;
    trabajador: PersonaTemplate;
    empleador: Record<string, string>;

    // ── Act-specific data sections ──
    vehiculo: Record<string, string>;
    boleto_datos: Record<string, string>;
    dacion_datos: Record<string, string>;
    condominio_datos: Record<string, string>;
    permuta_datos: Record<string, string>;
    constatacion: Record<string, string>;
    constatacion_datos: Record<string, string>;
    sucesion: Record<string, string>;
    escribano: Record<string, string>;
    inmuebles: Record<string, string>[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY = "";

// ---------------------------------------------------------------------------
// Spanish date helpers — for notarial date format
// "a los {{ fecha_dia_letras }} días del mes de {{ fecha_mes_letras }}
//  del año {{ fecha_anio_letras }}"
// ---------------------------------------------------------------------------

const _UNIDADES = [
    "", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
    "diez", "once", "doce", "trece", "catorce", "quince",
    "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte",
    "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco",
    "veintiséis", "veintisiete", "veintiocho", "veintinueve", "treinta", "treinta y uno",
];

const _MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function dayToSpanish(day: number): string {
    if (day >= 1 && day <= 31) return _UNIDADES[day];
    return day.toString();
}

function monthToSpanish(month: number): string {
    if (month >= 0 && month <= 11) return _MESES[month];
    return (month + 1).toString();
}

function yearToSpanish(year: number): string {
    if (year < 2000 || year > 2099) return year.toString();
    const remainder = year - 2000;
    if (remainder === 0) return "dos mil";
    return `dos mil ${_UNIDADES[remainder] || remainder.toString()}`;
}

/** Extract date parts as Spanish words from an ISO date string */
function extractDatePartsSpanish(dateStr: string | null): {
    dia: string;
    mes: string;
    anio: string;
} {
    if (!dateStr) return { dia: EMPTY, mes: EMPTY, anio: EMPTY };
    try {
        const d = new Date(dateStr);
        return {
            dia: dayToSpanish(d.getDate()),
            mes: monthToSpanish(d.getMonth()),
            anio: yearToSpanish(d.getFullYear()),
        };
    } catch {
        return { dia: EMPTY, mes: EMPTY, anio: EMPTY };
    }
}

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

/** Returns an empty PersonaTemplate (all fields = "") */
function emptyPersona(): PersonaTemplate {
    return {
        nombre_completo: EMPTY,
        tipo_documento: EMPTY,
        numero_documento: EMPTY,
        nacionalidad: EMPTY,
        estado_civil: EMPTY,
        domicilio: EMPTY,
        cuit_cuil: EMPTY,
        fecha_nacimiento: EMPTY,
        profesion: EMPTY,
    };
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

    // 2b. Fetch último presupuesto (fuente preferida para monto/moneda)
    const { data: presupuesto } = await supabase
        .from("presupuestos")
        .select("monto_operacion, moneda, version")
        .eq("carpeta_id", carpetaId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
    const presupuestoActual: PresupuestoDB | null = (presupuesto as PresupuestoDB | null) || null;

    // 3. Fetch escribano (default)
    const { data: escribano } = await supabase
        .from("escribanos")
        .select("*")
        .eq("is_default", true)
        .single();

    // 4. Extract nested data — fuente de verdad: escritura TRAMITE
    const escritura = carpeta.escrituras?.find((e: any) => e.source === 'TRAMITE') || carpeta.escrituras?.[0];
    const operacion: OperacionDB | undefined = escritura?.operaciones?.[0];
    const inmueble: InmuebleDB | undefined = escritura?.inmuebles;
    const participantes: ParticipanteDB[] = operacion?.participantes_operacion || [];

    // 5. Classify participants by role
    //    Mesa de Trabajo convention:
    //    - Transmitentes (vendedores): son los titulares del antecedente, tienen roles
    //      COMPRADOR/TITULAR/CESIONARIO/DONATARIO asignados por la ingesta.
    //    - Adquirentes (compradores): agregados manualmente con rol "ADQUIRENTE".
    //    - También aceptamos "VENDEDOR"/"TRANSMITENTE" para carpetas sin antecedente.
    const vendedoresDB = filterByRol(participantes,
        "VENDEDOR", "TRANSMITENTE", "CEDENTE", "DONANTE",
        "COMPRADOR", "TITULAR", "CESIONARIO", "DONATARIO"
    ).filter(p => p.rol?.toUpperCase() !== "ADQUIRENTE"); // excluir adquirentes manuales
    const compradoresDB = filterByRol(participantes, "ADQUIRENTE");
    const apoderadoDB = findByRol(participantes, "APODERADO", "REPRESENTANTE");

    // 6. Build conyuge from vendedor's datos_conyuge
    const vendedorPrincipal = vendedoresDB[0]?.personas;
    const conyugeData = vendedorPrincipal?.datos_conyuge;

    // 7. Detect persona jurídica among participants
    const personaJuridica = participantes.find(
        (p) => p.personas?.tipo_persona === "JURIDICA" || p.personas?.tipo_persona === "FIDEICOMISO"
    );

    // 8. Build the context object matching Jinja2 tags exactly
    //    Fields marked "Alias TB" are synonyms emitted for the Template Builder
    //    templates. They duplicate an existing value under the name the template expects.
    const fechaParts = extractDatePartsSpanish(escritura?.fecha_escritura);
    const actoTitulo = operacion?.tipo_acto || EMPTY;

    const montoPresupuesto = presupuestoActual?.monto_operacion ?? null;
    const currencyMeta = presupuestoActual?.moneda
        ? normalizeCurrencyMeta(presupuestoActual.moneda)
        : null;

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
            // Alias TB
            localidad_otorgamiento: escribano?.distrito_notarial || EMPTY,
            distrito_notarial: escribano?.distrito_notarial || EMPTY,
            tipo_acto: actoTitulo,
            partido: escribano?.distrito_notarial || EMPTY,
            fecha_dia_letras: fechaParts.dia,
            fecha_mes_letras: fechaParts.mes,
            fecha_anio_letras: fechaParts.anio,
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
            partido_code: (inmueble as any)?.partido_code || EMPTY,
            delegacion_code: (inmueble as any)?.delegacion_code || EMPTY,
            ubicacion_provincia: "Buenos Aires",
            linderos_norte: EMPTY,
            linderos_sur: EMPTY,
            linderos_este: EMPTY,
            // Alias TB
            descripcion: inmueble?.transcripcion_literal || EMPTY,
            partida_inmobiliaria: inmueble?.nro_partida || EMPTY,
            partido: inmueble?.partido_id || EMPTY,
            circunscripcion: EMPTY, // extraer de nomenclatura a futuro
            seccion: EMPTY,
            quinta: EMPTY,
            manzana: EMPTY,
            parcela: EMPTY,
            subparcela: EMPTY,
            porcentaje_copropiedad: EMPTY,
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
            // Alias TB
            tipo_acto: EMPTY, // ej: "Compraventa", extraer de titulo_antecedente texto
            // Nota: el campo inmuebles.titulo_antecedente contiene el texto completo
            // del tracto. A futuro la IA lo puede descomponer en campos estructurados.
        },

        // --- operación ---
        operacion: {
            precio_venta: (() => {
                if (!montoPresupuesto || !currencyMeta) return EMPTY;
                return formatMoney(montoPresupuesto, currencyMeta.symbol);
            })(),
            precio_letras: (() => {
                if (!montoPresupuesto || !currencyMeta) return EMPTY;
                return priceToSpanishWords(montoPresupuesto, currencyMeta.labelUpper, currencyMeta.symbol);
            })(),
            moneda: currencyMeta?.labelLower || EMPTY,
            forma_pago: EMPTY, // no persiste en BD aún
            plazo_pago: EMPTY,
            // Alias TB
            precio_total: (() => {
                if (!montoPresupuesto || !currencyMeta) return EMPTY;
                return formatMoney(montoPresupuesto, currencyMeta.symbol);
            })(),
            precio_numeros: montoPresupuesto?.toString() || EMPTY,
            senia: EMPTY,
            saldo: EMPTY,
            valuacion_fiscal: EMPTY,
            valuacion_fiscal_acto: EMPTY,
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
            // Alias TB
            catastro: findCert(certs, "CATASTRAL")?.nro_certificado || EMPTY,
            inhibiciones: findCert(certs, "INHIBICION")?.nro_certificado || EMPTY,
            fecha_registro_propiedad: formatDateNotarial(findCert(certs, "DOMINIO")?.fecha_recepcion || null),
        },

        // --- impuestos ---
        impuestos: {
            base_imponible: EMPTY, // se calcula con taxCalculator
            sellados: EMPTY,
            iti: EMPTY,
            // Alias TB
            iti_monto: EMPTY,
            ganancias: EMPTY,
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
            // Alias TB
            domicilio_legal: personaJuridica?.personas?.domicilio_real?.literal || EMPTY,
            representante_nombre: personaJuridica?.datos_representacion?.representa_a
                ? personaJuridica.datos_representacion.representa_a
                : EMPTY,
        },

        // ═══════════════════════════════════════════════════════════════
        // ROLE ALIASES — same data, different Jinja2 key per act type
        // The Template Builder templates use role-specific names like
        // {{ donantes[0].nombre_completo }} instead of generic vendedores.
        // docxtpl resolves these from the context keys below.
        // ═══════════════════════════════════════════════════════════════

        // Donaciones: donantes = transmitentes, donatarios = adquirentes
        donantes: vendedoresDB.map((p) => mapPersona(p.personas)),
        donatarios: compradoresDB.map((p) => mapPersona(p.personas)),
        donante: vendedoresDB[0] ? mapPersona(vendedoresDB[0].personas) : emptyPersona(),

        // Cesiones: cedentes = transmitentes, cesionarios = adquirentes
        cedentes: vendedoresDB.map((p) => mapPersona(p.personas)),
        cesionarios: compradoresDB.map((p) => mapPersona(p.personas)),

        // Genéricos: transmitentes / adquirentes
        transmitentes: vendedoresDB.map((p) => mapPersona(p.personas)),
        adquirentes: compradoresDB.map((p) => mapPersona(p.personas)),

        // Poderes: poderdantes = otorgantes, apoderados = representantes
        poderdantes: vendedoresDB.map((p) => mapPersona(p.personas)),
        apoderados: apoderadoDB
            ? [mapPersona(apoderadoDB.personas)]
            : compradoresDB.map((p) => mapPersona(p.personas)),

        // Actas: requirente (singular y plural)
        requirente: vendedoresDB[0] ? mapPersona(vendedoresDB[0].personas) : emptyPersona(),
        requirentes: vendedoresDB.map((p) => mapPersona(p.personas)),

        // Generales: comparecientes = todos los participantes
        comparecientes: participantes.map((p) => mapPersona(p.personas)),
        autorizados: compradoresDB.map((p) => mapPersona(p.personas)),
        permutantes: participantes.map((p) => mapPersona(p.personas)),
        beneficiarios: compradoresDB.map((p) => mapPersona(p.personas)),
        usufructuantes: vendedoresDB.map((p) => mapPersona(p.personas)),
        usufructuarios: compradoresDB.map((p) => mapPersona(p.personas)),
        partes: participantes.map((p) => mapPersona(p.personas)),
        otros_comparecientes: participantes.map((p) => mapPersona(p.personas)),

        // Roles singulares
        acreedor: compradoresDB[0] ? mapPersona(compradoresDB[0].personas) : emptyPersona(),
        deudor: vendedoresDB[0] ? mapPersona(vendedoresDB[0].personas) : emptyPersona(),
        causante: vendedoresDB[0] ? mapPersona(vendedoresDB[0].personas) : emptyPersona(),

        // Apoderados por parte
        apoderado_vendedor: apoderadoDB ? mapPersona(apoderadoDB.personas) : emptyPersona(),
        apoderado_comprador: apoderadoDB ? mapPersona(apoderadoDB.personas) : emptyPersona(),

        // Trabajador / Empleador (autorizaciones)
        trabajador: compradoresDB[0] ? mapPersona(compradoresDB[0].personas) : emptyPersona(),
        empleador: {
            razon_social: personaJuridica?.personas?.nombre_completo || EMPTY,
            cuit: personaJuridica?.personas?.cuit || EMPTY,
            domicilio: personaJuridica?.personas?.domicilio_real?.literal || EMPTY,
        },

        // ═══════════════════════════════════════════════════════════════
        // ACT-SPECIFIC DATA SECTIONS — empty stubs, filled via overrides
        // The escribano can supply these through contextOverrides when
        // calling renderTemplate(). BD persistence pending.
        // ═══════════════════════════════════════════════════════════════

        vehiculo: {
            dominio: EMPTY, marca: EMPTY, modelo: EMPTY, tipo: EMPTY,
            chasis_marca: EMPTY, chasis_numero: EMPTY, motor_marca: EMPTY, motor_numero: EMPTY,
        },
        boleto_datos: {
            plazo_escrituracion: EMPTY, escribano_designado: EMPTY,
        },
        dacion_datos: {
            deuda_original: EMPTY, instrumento_deuda: EMPTY, monto_deuda: EMPTY, valor_bien_dado: EMPTY,
        },
        condominio_datos: {
            origen_condominio: EMPTY,
        },
        permuta_datos: {
            bien_1: EMPTY,
        },
        constatacion: {
            domicilio: EMPTY,
        },
        constatacion_datos: {
            lugar: EMPTY,
        },
        sucesion: {
            caratula: EMPTY, expediente_numero: EMPTY, juzgado_numero: EMPTY,
            secretaria_numero: EMPTY, departamento_judicial: EMPTY,
        },
        escribano: {
            domicilio: escribano?.domicilio_legal || EMPTY,
        },
        inmuebles: inmueble ? [{
            descripcion: inmueble.transcripcion_literal || EMPTY,
        }] : [],
    };

    return context;
}
