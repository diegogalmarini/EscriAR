"use server";

import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildTemplateContext } from "@/lib/templates/buildTemplateContext";

// @ts-ignore — no types for docxtemplater / pizzip / angular-expressions
import Docxtemplater from "docxtemplater";
// @ts-ignore
import PizZip from "pizzip";
// @ts-ignore
import expressionParser from "docxtemplater/expressions.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RenderResult {
    success: boolean;
    /** URL firmada para descargar el DOCX generado */
    downloadUrl?: string;
    /** Path en storage donde se guardó */
    storagePath?: string;
    /** Context JSON que se usó (para debug) */
    context?: Record<string, unknown>;
    error?: string;
}

// ---------------------------------------------------------------------------
// getActiveTemplate — busca el template activo para un act_type
// ---------------------------------------------------------------------------

async function getActiveTemplate(actType: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("modelos_actos")
        .select("*")
        .eq("act_type", actType)
        .eq("is_active", true)
        .order("version", { ascending: false })
        .limit(1)
        .single();

    if (error || !data) {
        throw new Error(`No hay template activo para act_type="${actType}": ${error?.message}`);
    }
    return data;
}

// ---------------------------------------------------------------------------
// downloadTemplate — baja el .docx de storage como Buffer
// ---------------------------------------------------------------------------

async function downloadTemplate(docxPath: string): Promise<Buffer> {
    const { data, error } = await supabaseAdmin.storage
        .from("escrituras")
        .download(docxPath);

    if (error || !data) {
        throw new Error(`No se pudo descargar template "${docxPath}": ${error?.message}`);
    }

    return Buffer.from(await data.arrayBuffer());
}

// ---------------------------------------------------------------------------
// renderDocx — renderiza DOCX con docxtemplater (JS, sin Python)
// ---------------------------------------------------------------------------

function renderDocx(templateBuffer: Buffer, context: Record<string, unknown>): Buffer {
    const zip = new PizZip(templateBuffer);

    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: "{{", end: "}}" },
        parser: expressionParser,
        // No lanzar error por tags sin datos — dejar string vacío
        nullGetter() {
            return "";
        },
    });

    doc.render(context);

    return Buffer.from(
        doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" })
    );
}

// ---------------------------------------------------------------------------
// uploadRendered — sube el DOCX generado a storage
// ---------------------------------------------------------------------------

async function uploadRendered(docxBuffer: Buffer, carpetaId: string, actType: string): Promise<string> {
    const storagePath = `carpetas/${carpetaId}/escritura_${actType}_${Date.now()}.docx`;

    const { error } = await supabaseAdmin.storage
        .from("escrituras")
        .upload(storagePath, docxBuffer, {
            contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            upsert: true,
        });

    if (error) {
        throw new Error(`Error subiendo DOCX a storage: ${error.message}`);
    }

    return storagePath;
}

// ---------------------------------------------------------------------------
// renderTemplate — Server Action principal
// ---------------------------------------------------------------------------

/**
 * Genera un DOCX renderizado a partir de un template y los datos de una carpeta.
 *
 * @param carpetaId - UUID de la carpeta
 * @param actType - Tipo de acto (ej: "compraventa")
 * @param contextOverrides - Campos opcionales para sobreescribir/completar datos que
 *                           no están en BD (ej: folio, tomo, precio_letras)
 */
export async function renderTemplate(
    carpetaId: string,
    actType: string,
    contextOverrides?: Record<string, unknown>
): Promise<RenderResult> {
    try {
        // 1. Buscar template activo
        const template = await getActiveTemplate(actType);

        // 2. Bajar .docx de storage como Buffer
        const templateBuffer = await downloadTemplate(template.docx_path);

        // 3. Construir context desde BD
        const context = await buildTemplateContext(carpetaId) as unknown as Record<string, unknown>;

        // 4. Aplicar overrides (ej: datos que completa el escribano al firmar)
        if (contextOverrides) {
            for (const [key, value] of Object.entries(contextOverrides)) {
                if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                    context[key] = { ...(context[key] as Record<string, unknown> || {}), ...value as Record<string, unknown> };
                } else {
                    context[key] = value;
                }
            }
        }

        // 5. Renderizar DOCX con docxtemplater (JS — no requiere Python)
        const renderedBuffer = renderDocx(templateBuffer, context);

        // 6. Subir a storage
        const storagePath = await uploadRendered(renderedBuffer, carpetaId, actType);

        // 7. Generar URL firmada (1 hora)
        const { data: signedUrl } = await supabaseAdmin.storage
            .from("escrituras")
            .createSignedUrl(storagePath, 3600);

        return {
            success: true,
            downloadUrl: signedUrl?.signedUrl || undefined,
            storagePath,
            context,
        };
    } catch (error: any) {
        console.error("[renderTemplate] Error:", error);
        return {
            success: false,
            error: error.message,
        };
    }
}

// ---------------------------------------------------------------------------
// previewTemplateContext — Solo construye el context (para debug/UI)
// ---------------------------------------------------------------------------

export async function previewTemplateContext(
    carpetaId: string
): Promise<{ success: boolean; context?: Record<string, unknown>; error?: string }> {
    try {
        const context = await buildTemplateContext(carpetaId);
        return { success: true, context: context as unknown as Record<string, unknown> };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
