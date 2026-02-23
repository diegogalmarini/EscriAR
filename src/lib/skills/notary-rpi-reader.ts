import { GoogleGenerativeAI } from "@google/generative-ai";
import { MODEL_MAPPING } from "../aiConfig";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
import { TipoGravamen } from '@/app/actions/gravamenes';

export interface GravamenExtract {
    tipo: TipoGravamen;
    monto: number | null;
    moneda: string | null;
    autos: string | null;
    juzgado: string | null;
    fecha_inscripcion: string | null;
    estado: "VIGENTE" | "LEVANTADO" | "CADUCO";
    observaciones: string | null;
    persona_inhibida?: string | null; // Nombre de la persona si es inhibición
    persona_inhibida_dni?: string | null; // DNI de la persona inhibida
}

export interface RpiReaderResult {
    is_clean: boolean;
    detected_liens: GravamenExtract[];
    critical_flags: string[];
}

/**
 * Analiza el texto OCR de un certificado del Registro de la Propiedad Inmueble (RPI)
 * para detectar gravámenes, bloqueos o inhibiciones utilizando Google Gemini.
 * 
 * @param ocrText El texto extraído del PDF del certificado.
 * @param tipoCertificado 'DOMINIO' o 'INHIBICION'.
 * @returns RpiReaderResult con la extracción estructurada.
 */
export async function analyzeRpiReport(ocrText: string, tipoCertificado: 'DOMINIO' | 'INHIBICION'): Promise<RpiReaderResult> {
    const model = genAI.getGenerativeModel({
        model: MODEL_MAPPING.complex,
        generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1, // Baja temperatura para análisis determinístico
        },
    });

    const prompt = `
  Eres un Escribano Público auditor experto en lectura de Certificados del Registro de la Propiedad Inmueble de Argentina (Provincia de Buenos Aires y CABA).
  Se te entregará el texto OCR de un certificado de tipo: ${tipoCertificado}.
  
  Tu tarea es determinar si el inmueble o las personas tienen LIBRE DISPONIBILIDAD ("is_clean": true) o si existe algún gravamen/bloqueo ("is_clean": false).
  
  REGLAS ESTRICTAS DE EXTRACCIÓN:
  1. Si lees "No registra inhibiciones", "El inmueble se encuentra libre de gravámenes", "Informe Negativo", o expresiones similares que denotan inexistencia de medidas, debes marcar "is_clean": true y dejar los vectores vacíos.
  2. Si encuentras menciones activas a: EMBARGO, HIPOTECA, INHIBICION GENERAL DE BIENES, BIEN DE FAMILIA, AFECTACION A VIVIENDA, USUFRUCTO, o LITIS; debes extraer sus datos en 'detected_liens'.
  3. Presta extrema atención a las CANCELACIONES. Si ves que un embargo está "LEVANTADO" o "CANCELADO", su estado no es VIGENTE, es "LEVANTADO".
  4. Extrae montos, moneda (Ej: ARS o USD), número de autos/expediente, juzgado/secretaría interviniente, y fecha de inscripción si constan.
  5. En 'critical_flags', redacta una advertencia humana si existe un bloqueo (ej: "ATENCIÓN: Se detectó un Embargo Ejecutivo vigente que bloquea la venta del inmueble").
  
  TIPOS PERMITIDOS DE GRAVAMEN (Exact Match): "EMBARGO" | "HIPOTECA" | "INHIBICION_GENERAL" | "BIEN_DE_FAMILIA" | "USUFRUCTO" | "LITIS" | "OTRO".
  
  Format de Salida Requerido (DEBE SER JSON VÁLIDO CONFORME AL SIGUIENTE SCHEMA):
  {
      "is_clean": boolean,
      "detected_liens": [
          {
              "tipo": "EMBARGO",
              "monto": number | null,
              "moneda": string | null,
              "autos": string | null,
              "juzgado": string | null,
              "fecha_inscripcion": "YYYY-MM-DD" | null,
              "estado": "VIGENTE" | "LEVANTADO" | "CADUCO",
              "observaciones": string | null,
              "persona_inhibida": string | null, // Nombre de la persona inhibida
              "persona_inhibida_dni": string | null // DNI/CUIT de la persona inhibida (SOLO números)
          }
      ],
      "critical_flags": ["string"]
  }
  
  Texto a analizar:
  """
  ${ocrText}
  """
  `;

    try {
        const response = await model.generateContent(prompt);

        const resultText = response.response.text();
        if (!resultText) {
            throw new Error("Respuesta vacía de Gemini");
        }

        const parsedResult: RpiReaderResult = JSON.parse(resultText);
        return parsedResult;

    } catch (error) {
        console.error("Error en RPI Reader Skill:", error);
        // En caso de fallo catastrófico de la IA, devolvemos un estado limpio preventivo o lanzamos error.
        throw new Error("No se pudo analizar el certificado RPI vía Gemini.");
    }
}
