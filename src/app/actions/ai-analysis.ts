"use server";

import { createClient } from '@/lib/supabaseServer';
import { analyzeRpiReport, RpiReaderResult } from "@/lib/skills/notary-rpi-reader";
import { createGravamen, GravamenInsert } from "./gravamenes";

/**
 * Analiza un certificado RPI (Dominio o Inhibición) usando Gemini AI,
 * persiste los gravámenes detectados en la tabla `gravamenes`,
 * y devuelve el resultado estructurado.
 */
export async function analyzeCertificadoRPI(certificadoId: string): Promise<RpiReaderResult> {
    const supabase = await createClient();

    // 1. Traer certificado con su carpeta_id
    const { data: cert, error: certError } = await supabase
        .from("certificados")
        .select("*")
        .eq("id", certificadoId)
        .single();

    if (certError || !cert) {
        throw new Error("Certificado no encontrado.");
    }

    if (!cert.pdf_url) {
        throw new Error("El certificado no tiene un PDF adjunto para analizar.");
    }

    if (cert.tipo !== "DOMINIO" && cert.tipo !== "INHIBICION") {
        throw new Error("Solo podemos analizar certificados de Dominio e Inhibición.");
    }

    // 2. Extraer texto del PDF 
    // TODO: Integrar pipeline OCR real (Worker Railway con Tesseract/Pymupdf).
    // Por ahora inyectamos mock temporal para demostración del Hito de IA y BD.
    const isMockClean = Math.random() > 0.5;
    const mockTextDominioClean = `RPI PROVINCIA BUENOS AIRES. INFORME DE DOMINIO. INMUEBLE MATRICULA 1234. LIBRE DE GRAVAMENES. NO SE REGISTRAN EMBARGOS NI HIPOTECAS VIGENTES.`;
    const mockTextDominioDirty = `RPI PROVINCIA BUENOS AIRES. INFORME DE DOMINIO. SE REGISTRA EMBARGO A FAVOR DE AFIP POR LA SUMA DE $ 2.500.000 (PESOS DOS MILLONES QUINIENTOS MIL) EN AUTOS: AFIP C/ JUAN PEREZ S/ EJECUCION FISCAL JUZGADO FEDERAL 1.`;
    const mockTextInhibicionDirty = `SE REGISTRA INHIBICION GENERAL DE BIENES DE MARTINEZ CARLOS ALBERTO DNI 22.333.444 DECRETADA EL 15/04/2021 POR JUZGADO CIVIL Y COMERCIAL 3 EN AUTOS BANCO MACRO S.A. C/ MARTINEZ S/ COBRO EJECUTIVO.`;

    let ocrText = mockTextDominioClean;
    if (!isMockClean && cert.tipo === "DOMINIO") ocrText = mockTextDominioDirty;
    if (!isMockClean && cert.tipo === "INHIBICION") ocrText = mockTextInhibicionDirty;

    // 3. Pasar por Gemini Skill
    try {
        const result = await analyzeRpiReport(ocrText, cert.tipo);

        // 4. Persistir gravámenes detectados en la tabla `gravamenes`
        if (result.detected_liens && result.detected_liens.length > 0) {
            for (const lien of result.detected_liens) {
                const gravamenData: GravamenInsert = {
                    carpeta_id: cert.carpeta_id,
                    inmueble_id: cert.inmueble_id || null,
                    persona_id: null, // Se resolverá en el cruce de inhibiciones
                    certificado_id: certificadoId,
                    tipo: lien.tipo,
                    monto: lien.monto,
                    moneda: lien.moneda,
                    autos: lien.autos,
                    juzgado: lien.juzgado,
                    fecha_inscripcion: lien.fecha_inscripcion,
                    estado: lien.estado,
                    observaciones: [
                        lien.observaciones,
                        lien.persona_inhibida ? `Persona inhibida: ${lien.persona_inhibida}` : null,
                        lien.persona_inhibida_dni ? `DNI inhibido: ${lien.persona_inhibida_dni}` : null,
                    ].filter(Boolean).join(' | ') || null,
                };

                try {
                    await createGravamen(gravamenData);
                } catch (insertError) {
                    console.error("Error insertando gravamen individual:", insertError);
                    // Continuar con los demás aunque falle uno
                }
            }
        }

        return result;
    } catch (e: any) {
        throw new Error("Error en Gemini AI: " + e.message);
    }
}
