import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * HYBRID HIERARCHY v2.0 (Gemini 3 Era)
 * Estrategia de "Cerebro Híbrido":
 * - Flash: Para clasificación, chat rápido y tareas de interfaz (Latencia < 500ms).
 * - Pro: Para lectura jurídica profunda, extracción de hipotecas y redacción compleja (Razonamiento Superior).
 */
export const MODEL_MAPPING = {
    fast: "gemini-2.5-flash",      // Clasificación, UI, Extracción simple
    complex: "gemini-2.5-pro",     // Lectura de Escrituras (24.pdf), Hipotecas, Sociedades
    vision: "gemini-2.5-flash"      // OCR con ruido, DNI, Planos
};

// Mantenemos esto por compatibilidad, pero apuntando a FLASH como prioridad para evitar timeouts
export const MODEL_HIERARCHY = [
    MODEL_MAPPING.fast,    // SILVER: Flash (Now Primary for speed)
    MODEL_MAPPING.complex, // GOLD: Pro
    MODEL_MAPPING.fast     // BRONZE: Flash
];

/**
 * getModelHierarchy: Returns the full hierarchy for the SkillExecutor to handle fallbacks.
 */
export function getModelHierarchy() {
    return MODEL_HIERARCHY;
}

/**
 * ACTA_EXTRACCION_PARTES_SCHEMA
 * Strict JSON Schema for the Notary Entity Extractor GOLD standard.
 * Refactored for Google SDK (v1beta) compatibility using SchemaType.
 */
export const ACTA_EXTRACCION_PARTES_SCHEMA: any = {
    type: SchemaType.OBJECT,
    properties: {
        tipo_objeto: {
            type: SchemaType.STRING,
            description: "Debe ser ACTA_EXTRACCION_PARTES"
        },
        entidades: {
            type: SchemaType.ARRAY,
            description: "Lista de personas físicas o jurídicas participantes. CRITICO: Distinguir Representantes de Representados.",
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    rol: {
                        type: SchemaType.STRING,
                        description: "VENDEDOR, COMPRADOR, CEDENTE, CESIONARIO, FIDUCIARIA, ACREEDOR (Banco), DEUDOR, FIADOR. Si es apoderado, usar 'APODERADO/REPRESENTANTE'."
                    },
                    tipo_persona: {
                        type: SchemaType.STRING,
                        description: "FISICA, JURIDICA o FIDEICOMISO"
                    },
                    datos: {
                        type: SchemaType.OBJECT,
                        properties: {
                            nombre_completo: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    nombres: { type: SchemaType.STRING, description: "Solo Nombres (ej: Juan Carlos)" },
                                    apellidos: { type: SchemaType.STRING, description: "Solo Apellidos (ej: Perez Garcia)" },
                                    evidencia: { type: SchemaType.STRING }
                                },
                                required: ["nombres", "apellidos", "evidencia"]
                            },
                            dni: {
                                type: SchemaType.OBJECT,
                                description: "DNI: 7-8 dígitos SIN guiones. Ej: 25765599. SOLO para Personas Físicas. null para Jurídicas.",
                                properties: {
                                    valor: { type: SchemaType.STRING, nullable: true },
                                    evidencia: { type: SchemaType.STRING }
                                },
                                required: ["valor", "evidencia"]
                            },
                            cuit_cuil: {
                                type: SchemaType.OBJECT,
                                description: "CUIT/CUIL: 11 dígitos con formato XY-DDDDDDDD-Z. Ej: 20-25765599-8. Preservar guiones. null si no está en documento.",
                                properties: {
                                    valor: { type: SchemaType.STRING, nullable: true },
                                    evidencia: { type: SchemaType.STRING }
                                },
                                required: ["valor", "evidencia"]
                            },
                            estado_civil: { // Solo para Personas Físicas
                                type: SchemaType.OBJECT,
                                properties: {
                                    valor: { type: SchemaType.STRING, nullable: true },
                                    evidencia: { type: SchemaType.STRING }
                                },
                                required: ["valor", "evidencia"]
                            },
                            nupcias: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    valor: { type: SchemaType.NUMBER, nullable: true },
                                    descripcion: { type: SchemaType.STRING },
                                    evidencia: { type: SchemaType.STRING }
                                },
                                required: ["valor", "descripcion", "evidencia"]
                            },
                            domicilio: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    valor: {
                                        type: SchemaType.STRING,
                                        nullable: true,
                                        description: "Dirección COMPLETA y LITERAL. Debe incluir el tipo de vía."
                                    },
                                    evidencia: { type: SchemaType.STRING }
                                },
                                required: ["valor", "evidencia"]
                            },
                            nacionalidad: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    valor: { type: SchemaType.STRING, nullable: true },
                                    evidencia: { type: SchemaType.STRING }
                                },
                                required: ["valor", "evidencia"]
                            },
                            fecha_nacimiento: {
                                type: SchemaType.OBJECT,
                                description: "Fecha en formato ISO YYYY-MM-DD. Convertir texto a ISO.",
                                properties: {
                                    valor: { type: SchemaType.STRING, nullable: true },
                                    evidencia: { type: SchemaType.STRING }
                                },
                                required: ["valor", "evidencia"]
                            },
                            nombres_padres: {
                                type: SchemaType.OBJECT,
                                description: "Nombres del padre y de la madre si se mencionan. Ej: 'Hijo de Juan y Maria'.",
                                properties: {
                                    valor: { type: SchemaType.STRING, nullable: true },
                                    evidencia: { type: SchemaType.STRING }
                                },
                                required: ["valor", "evidencia"]
                            },
                            conyuge: {
                                type: SchemaType.OBJECT,
                                description: "Datos detallados del cónyuge (Nombre, DNI, CUIT). Extraer exhaustivamente si se mencionan en cualquier parte del documento.",
                                properties: {
                                    nombre_completo: { type: SchemaType.STRING, nullable: true },
                                    dni: { type: SchemaType.STRING, nullable: true },
                                    cuit_cuil: { type: SchemaType.STRING, nullable: true },
                                    evidencia: { type: SchemaType.STRING }
                                },
                                required: ["evidencia"]
                            }
                        },
                        required: ["nombre_completo", "dni", "cuit_cuil", "domicilio"] // dni y cuit_cuil separados
                    },
                    representacion: {
                        type: SchemaType.OBJECT,
                        description: "Detalle de la cadena de mando / poder.",
                        properties: {
                            es_representado: { type: SchemaType.BOOLEAN, description: "True si esta entidad actúa a través de un humano (ej. Banco)." },
                            representantes: {
                                type: SchemaType.ARRAY,
                                items: {
                                    type: SchemaType.OBJECT,
                                    properties: {
                                        nombre: { type: SchemaType.STRING },
                                        caracter: { type: SchemaType.STRING, description: "Apoderado, Presidente, Socio Gerente" },
                                        dni: { type: SchemaType.STRING, nullable: true },
                                        cuit_cuil: { type: SchemaType.STRING, nullable: true },
                                        nacionalidad: { type: SchemaType.STRING, nullable: true },
                                        fecha_nacimiento: { type: SchemaType.STRING, nullable: true, description: "Formato YYYY-MM-DD" },
                                        estado_civil: { type: SchemaType.STRING, nullable: true },
                                        domicilio: { type: SchemaType.STRING, nullable: true }
                                    },
                                    required: ["nombre", "caracter"]
                                }
                            },
                            documento_base: { type: SchemaType.STRING, nullable: true },
                            folio_evidencia: { type: SchemaType.STRING, nullable: true },
                            poder_detalle: { type: SchemaType.STRING, nullable: true, description: "Texto completo del poder: tipo (general/especial), escritura número, fecha, escribano otorgante, folio, registro. Ej: 'poder general amplio conferido por escritura número 100 de fecha 21/03/2018, ante escribano Santiago Alvarez Fourcade, folio 733 del Registro a su cargo'" }
                        },
                        required: ["es_representado"]
                    }
                },
                required: ["rol", "tipo_persona", "datos", "representacion"]
            }
        },
        inmuebles: {
            type: SchemaType.ARRAY,
            description: "Lista de inmuebles objeto de la operación",
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    partido: {
                        type: SchemaType.OBJECT,
                        description: "Nombre del Partido (ej: La Plata, Bahía Blanca). NO EXTRAER CÓDIGOS NUMÉRICOS (ej: 007). Si aparecen ambos, extraer SOLO EL NOMBRE.",
                        properties: { valor: { type: SchemaType.STRING }, evidencia: { type: SchemaType.STRING } },
                        required: ["valor", "evidencia"]
                    },
                    partida_inmobiliaria: {
                        type: SchemaType.OBJECT,
                        properties: { valor: { type: SchemaType.STRING }, evidencia: { type: SchemaType.STRING } },
                        required: ["valor", "evidencia"]
                    },
                    nomenclatura: {
                        type: SchemaType.OBJECT,
                        properties: { valor: { type: SchemaType.STRING }, evidencia: { type: SchemaType.STRING } },
                        required: ["valor", "evidencia"]
                    },
                    transcripcion_literal: {
                        type: SchemaType.OBJECT,
                        description: "Transcripción COMPLETA Y LITERAL del Inmueble SOLAMENTE. Comienza desde la ubicación ('un departamento...', 'una unidad funcional...') copiando medidas, linderos, nomenclatura catastral, partida y valuación fiscal. NO INCLUIR la sección TITULO ANTECEDENTE (eso va en campo separado).",
                        properties: { valor: { type: SchemaType.STRING }, evidencia: { type: SchemaType.STRING } },
                        required: ["valor", "evidencia"]
                    },
                    titulo_antecedente: {
                        type: SchemaType.OBJECT,
                        description: "Transcripción LITERAL Y COMPLETA de la sección 'TITULO ANTECEDENTE' o 'ANTECEDENTES DE DOMINIO'. Copiar palabra por palabra desde 'Les corresponde...' o 'Le corresponde...' hasta la inscripción registral (Matrícula/Folio). Si no existe esta sección, dejar vacío.",
                        properties: { valor: { type: SchemaType.STRING }, evidencia: { type: SchemaType.STRING } },
                        required: ["valor", "evidencia"]
                    },
                    valuacion_fiscal: {
                        type: SchemaType.OBJECT,
                        properties: { valor: { type: SchemaType.NUMBER }, evidencia: { type: SchemaType.STRING } },
                        required: ["valor", "evidencia"]
                    }
                },
                required: ["partido", "partida_inmobiliaria", "nomenclatura", "transcripcion_literal", "valuacion_fiscal"]
            }
        },
        detalles_operacion: {
            type: SchemaType.OBJECT,
            properties: {
                precio: {
                    type: SchemaType.OBJECT,
                    properties: { valor: { type: SchemaType.NUMBER }, moneda: { type: SchemaType.STRING, description: "ARS, USD, UVA" }, evidencia: { type: SchemaType.STRING } },
                    required: ["valor", "moneda", "evidencia"]
                },
                fecha_escritura: {
                    type: SchemaType.OBJECT,
                    properties: { valor: { type: SchemaType.STRING }, evidencia: { type: SchemaType.STRING } },
                    required: ["valor", "evidencia"]
                },
                numero_escritura: {
                    type: SchemaType.OBJECT,
                    properties: { valor: { type: SchemaType.STRING }, evidencia: { type: SchemaType.STRING } },
                    required: ["valor", "evidencia"]
                },
                tipo_acto: {
                    type: SchemaType.OBJECT,
                    properties: { valor: { type: SchemaType.STRING }, evidencia: { type: SchemaType.STRING } },
                    required: ["valor", "evidencia"]
                },
                escribano_nombre: {
                    type: SchemaType.OBJECT,
                    properties: { valor: { type: SchemaType.STRING }, evidencia: { type: SchemaType.STRING } },
                    required: ["valor", "evidencia"]
                },
                registro_numero: {
                    type: SchemaType.OBJECT,
                    properties: { valor: { type: SchemaType.STRING }, evidencia: { type: SchemaType.STRING } },
                    required: ["valor", "evidencia"]
                },
                precio_construccion: {
                    type: SchemaType.OBJECT,
                    description: "Precio de construcción (histórico) en fideicomisos al costo.",
                    properties: {
                        monto: { type: SchemaType.NUMBER },
                        moneda: { type: SchemaType.STRING },
                        evidencia: { type: SchemaType.STRING }
                    },
                    required: ["monto", "moneda", "evidencia"]
                },
                partida_inmobiliaria: {
                    type: SchemaType.OBJECT,
                    description: "Si el acto es una CANCELACIÓN y el inmueble se menciona referencialmente (ej: 'sobre el inmueble...'), extraer la PARTIDA. Prioridad ALTA.",
                    properties: { valor: { type: SchemaType.STRING }, evidencia: { type: SchemaType.STRING } },
                    required: ["valor", "evidencia"]
                },
                partido_inmobiliario: {
                    type: SchemaType.OBJECT,
                    description: "Si el acto es una CANCELACIÓN y el inmueble se menciona referencialmente, extraer el PARTIDO (NOMBRE, NO CÓDIGO).",
                    properties: { valor: { type: SchemaType.STRING }, evidencia: { type: SchemaType.STRING } },
                    required: ["valor", "evidencia"]
                },
                precio_cesion: {
                    type: SchemaType.OBJECT,
                    description: "Precio de cesión de beneficiario (valor de mercado actual).",
                    properties: {
                        monto: { type: SchemaType.NUMBER },
                        moneda: { type: SchemaType.STRING },
                        tipo_cambio: { type: SchemaType.NUMBER, nullable: true },
                        equivalente_ars: { type: SchemaType.NUMBER, nullable: true },
                        evidencia: { type: SchemaType.STRING }
                    },
                    required: ["monto", "moneda", "evidencia"]
                },
                es_vivienda_unica: {
                    type: SchemaType.OBJECT,
                    description: "True si el inmueble se destina a 'Vivienda Única, Familiar y de Ocupación Permanente' (permite exención de sellos).",
                    properties: {
                        valor: { type: SchemaType.BOOLEAN },
                        evidencia: { type: SchemaType.STRING }
                    },
                    required: ["valor", "evidencia"]
                }
            },
            required: ["precio", "fecha_escritura", "numero_escritura", "tipo_acto", "escribano_nombre", "registro_numero"]
        },
        cesion_beneficiario: {
            type: SchemaType.OBJECT,
            description: "Detalle de la cesión de derechos fiduciarios / condición de beneficiario.",
            nullable: true,
            properties: {
                fideicomiso_nombre: { type: SchemaType.STRING, description: "Nombre del Fideicomiso (ej: FIDEICOMISO G-4)" },
                cedente: {
                    type: SchemaType.OBJECT,
                    properties: {
                        nombre: { type: SchemaType.STRING },
                        fecha_incorporacion: { type: SchemaType.STRING, nullable: true, description: "Fecha de incorporación original (ISO)" }
                    },
                    required: ["nombre"]
                },
                cesionario: {
                    type: SchemaType.OBJECT,
                    properties: {
                        nombre: { type: SchemaType.STRING },
                        dni: { type: SchemaType.STRING, nullable: true }
                    },
                    required: ["nombre"]
                },
                precio_cesion: {
                    type: SchemaType.OBJECT,
                    properties: {
                        monto: { type: SchemaType.NUMBER },
                        moneda: { type: SchemaType.STRING }
                    },
                    required: ["monto", "moneda"]
                },
                fecha_cesion: { type: SchemaType.STRING, description: "Fecha de la cesión (ISO)" }
            },
            required: ["cedente", "cesionario", "precio_cesion"]
        },
        validacion_sistemica: {
            type: SchemaType.OBJECT,
            properties: {
                coherencia_identidad: { type: SchemaType.BOOLEAN },
                observaciones_criticas: { type: SchemaType.STRING, nullable: true }
            },
            required: ["coherencia_identidad", "observaciones_criticas"]
        }
    },
    required: ["tipo_objeto", "entidades", "inmuebles", "detalles_operacion", "validacion_sistemica"]
};

/**
 * NOTARY_MORTGAGE_READER_SCHEMA
 * Specific schema for financial mortgage terms.
 */
export const NOTARY_MORTGAGE_READER_SCHEMA: any = {
    type: SchemaType.OBJECT,
    properties: {
        financial_terms: {
            type: SchemaType.OBJECT,
            properties: {
                capital: {
                    type: SchemaType.OBJECT,
                    properties: { valor: { type: SchemaType.NUMBER }, currency: { type: SchemaType.STRING }, evidencia: { type: SchemaType.STRING } },
                    required: ["valor", "currency", "evidencia"]
                },
                uva_quoted: {
                    type: SchemaType.OBJECT,
                    properties: { valor: { type: SchemaType.NUMBER }, evidencia: { type: SchemaType.STRING } },
                    required: ["valor", "evidencia"]
                },
                rate: {
                    type: SchemaType.OBJECT,
                    properties: { valor: { type: SchemaType.STRING }, evidencia: { type: SchemaType.STRING } },
                    required: ["valor", "evidencia"]
                },
                system: {
                    type: SchemaType.OBJECT,
                    properties: { valor: { type: SchemaType.STRING }, evidencia: { type: SchemaType.STRING } },
                    required: ["valor", "evidencia"]
                }
            },
            required: ["capital", "uva_quoted", "rate", "system"]
        },
        legal_status: {
            type: SchemaType.OBJECT,
            properties: {
                grado: { type: SchemaType.STRING },
                letra_hipotecaria: { type: SchemaType.BOOLEAN }
            },
            required: ["grado", "letra_hipotecaria"]
        }
    },
    required: ["financial_terms", "legal_status"]
};

/**
 * NOTARY_RELATION_AUDITOR_SCHEMA
 * Schema for data integrity audit skill.
 */
export const NOTARY_RELATION_AUDITOR_SCHEMA: any = {
    type: SchemaType.OBJECT,
    properties: {
        validacion_global: {
            type: SchemaType.OBJECT,
            properties: {
                es_valida: { type: SchemaType.BOOLEAN, description: "True si no hay errores críticos. Advertencias no invalidan." },
                resumen: { type: SchemaType.STRING }
            },
            required: ["es_valida", "resumen"]
        },
        alertas_y_errores: {
            type: SchemaType.OBJECT,
            properties: {
                errores_criticos: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING },
                    description: "Errores bloqueantes como falta de DNI/CUIT o Nomenclatura."
                },
                advertencias: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING },
                    description: "Avisos como falta de estado civil, email o teléfono."
                }
            },
            required: ["errores_criticos", "advertencias"]
        }
    },
    required: ["validacion_global", "alertas_y_errores"]
};

/**
 * getLatestModel: Inteligencia de Selección de Modelo.
 * - INGEST (Lectura): Usa PRO para entender estructuras complejas (Bancos, Poderes).
 * - DRAFT (Redacción): Usa PRO para garantizar precisión legal.
 * - CLASSIFY (Otros): Usa FLASH para velocidad.
 */
export async function getLatestModel(taskType: 'INGEST' | 'DRAFT' | 'CLASSIFY' = 'DRAFT'): Promise<string> {
    // ⚠️ CRITICAL: Use PRO for all heavy lifting (Ingestion & Drafting) to avoid missing entities.
    if (taskType === 'INGEST' || taskType === 'DRAFT') {
        console.log(`[AI_CONFIG] Using GOLD Model (${MODEL_MAPPING.complex}) for ${taskType}`);
        return MODEL_MAPPING.complex; // Gemini 3 Pro
    }
    return MODEL_MAPPING.fast; // Gemini 3 Flash
}

/**
 * estimateCost: Calculates the USD cost based on token usage.
 * Updated for Gemini 3 pricing tiers.
 */
export function estimateCost(modelName: string, inputTokens: number, outputTokens: number): number {
    const isPro = modelName.includes('pro');
    // Precios Estimados Gemini 3 (Sujeto a cambios oficiales)
    // Pro: $3.50/$10.50 (aprox) | Flash: $0.10/$0.40
    const inputPrice = isPro ? 3.50 : 0.10;
    const outputPrice = isPro ? 10.50 : 0.40;

    return ((inputTokens * inputPrice) + (outputTokens * outputPrice)) / 1000000;
}

/**
 * getOrBuildContextCache: Manages Google Context Caching.
 * Reduces costs by 90% for repeated large contexts (Manuals, Laws).
 */
export async function getOrBuildContextCache(content: string, modelName: string): Promise<string | null> {
    // Caching is only effective for content > 32k tokens.
    if (content.length < 100000) return null; // Very rough estimate for 32k tokens

    console.log(`[AI_CONFIG] High-redundancy context detected (${content.length} chars). Checking Context Cache...`);

    // In a production environment, we would use crypto.createHash to identify the content
    // and check a local/DB cache of existing ContextCache names.
    // For now, this serves as the hook for the Notary Cost Monitor skill.
    return null;
}