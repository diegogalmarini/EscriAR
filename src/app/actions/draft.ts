"use server";

import { createClient } from "@/lib/supabaseServer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getLatestModel } from "@/lib/aiConfig";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function generateDeedDraft(escrituraId: string, escribanoId?: string) {
    try {
        const supabase = await createClient();
        const modelName = await getLatestModel();
        const model = genAI.getGenerativeModel({ model: modelName });

        // 1. Fetch Deep Data
        const { data: escritura, error } = await supabase
            .from("escrituras")
            .select(`
        *,
        inmuebles (*),
        operaciones (
          *,
          participantes_operacion (
            *,
            personas (*)
          )
        )
      `)
            .eq("id", escrituraId)
            .single();

        if (error || !escritura) {
            return { success: false, error: "No se pudieron obtener los datos de la escritura" };
        }

        // 2. Fetch Notary Data if provided
        let escribanoDetails = null;
        if (escribanoId) {
            const { data: escData } = await supabase
                .from("escribanos")
                .select("*")
                .eq("id", escribanoId)
                .single();
            escribanoDetails = escData;
        }

        // 3. Format Data for AI
        const promptData = {
            tipo_acto: escritura.operaciones[0]?.tipo_acto || "Escritura",
            monto: escritura.operaciones[0]?.monto_operacion,
            inmueble: escritura.inmuebles,
            participantes: escritura.operaciones[0]?.participantes_operacion.map((p: any) => ({
                nombre: p.personas.nombre_completo,
                dni_cuil: p.personas.tax_id,
                rol: p.rol,
                domicilio: p.personas.direccion_completa,
                estado_civil: p.personas.estado_civil_detalle || "de estado civil soltero"
            })),
            escribano: escribanoDetails ? {
                nombre: escribanoDetails.nombre_completo,
                caracter: escribanoDetails.caracter === 'A_CARGO' ? 'a cargo del' : escribanoDetails.caracter?.toLowerCase(),
                registro: escribanoDetails.numero_registro,
                distrito: escribanoDetails.distrito_notarial,
                titulo: escribanoDetails.genero_titulo,
                domicilio_legal: escribanoDetails.domicilio_legal
            } : null
        };

        // 4. Prompt Engineering
        const prompt = `
      Actúa como un Escribano Público Argentino experto en redacción de escrituras.
      Tu tarea es redactar el borrador de una escritura de ${promptData.tipo_acto}.
      
      DATOS ESTRUCTURADOS (JSON):
      ${JSON.stringify(promptData, null, 2)}
      
      REGLAS DE REDACCIÓN:
      1. Usa lenguaje jurídico formal y solemne.
      2. Respeta estrictamente las concordancias de género y número.
      3. ESTRUCTURA:
         - ENCABEZADO: Lugar (Ciudad de Buenos Aires) y fecha actual.
         - COMPARECENCIA ANTE NOTARIO: ${promptData.escribano ?
                `Debe iniciar con: "ANTE MÍ, ${promptData.escribano.nombre}, ${promptData.escribano.titulo} ${promptData.escribano.caracter} Registro número ${promptData.escribano.registro} de este Distrito Notarial de ${promptData.escribano.distrito}..."` :
                `Inicia con la comparecencia ante el escribano autorizante (usa datos genéricos si no hay).`}
         - COMPARECIENTES: Individualización completa según los datos provistos.
         - INTERVENCIÓN: Indicar por quién actúan.
         - OBJETO O ACTO: La descripción del inmueble (usa las medidas y linderos provistos).
         - PRECIO Y FORMA DE PAGO: Detallar el monto y que se recibe en este acto.
         - ASENTIMIENTO CONYUGAL: Si corresponde según estado civil.
      4. No inventes datos que no estén en el JSON. Usa [PENDIENTE] si falta algo crítico.
      5. Retorna solo el texto de la escritura, sin introducciones ni comentarios extras.
    `;

        const result = await model.generateContent(prompt);
        const draftContent = result.response.text();

        // 5. Persist in DB
        const { error: updateError } = await supabase
            .from("escrituras")
            .update({ contenido_borrador: draftContent })
            .eq("id", escrituraId);

        if (updateError) throw updateError;

        return { success: true, draft: draftContent };
    } catch (error: any) {
        console.error("Draft Error:", error);
        return { success: false, error: error.message };
    }
}

export async function saveDeedDraft(escrituraId: string, content: string) {
    const supabase = await createClient();
    const { error } = await supabase
        .from("escrituras")
        .update({ contenido_borrador: content })
        .eq("id", escrituraId);

    if (error) return { success: false, error: error.message };
    return { success: true };
}
