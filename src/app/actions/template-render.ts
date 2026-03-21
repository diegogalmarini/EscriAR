"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildTemplateContext } from "@/lib/templates/buildTemplateContext";
import {
    getActiveTemplate,
    getActiveTemplateWithResolver,
    downloadTemplate,
    renderDocx,
    generateHtmlPreview,
    uploadDocxToStorage,
    createSignedUrl,
} from "@/lib/templates/docxRenderer";
import { extractCounterpartyFromContext } from "@/lib/templates/modelResolver";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RenderResult {
    success: boolean;
    /** URL firmada para descargar el DOCX generado */
    downloadUrl?: string;
    /** Path en storage donde se guardó */
    storagePath?: string;
    /** HTML preview del DOCX generado (via mammoth) */
    htmlPreview?: string;
    /** Context JSON que se usó (para debug) */
    context?: Record<string, unknown>;
    error?: string;
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
        // 1. Construir context desde BD (needed for counterparty detection)
        const context = await buildTemplateContext(carpetaId) as unknown as Record<string, unknown>;

        // 2. Derive counterparty for smart model selection
        const counterpartyName = extractCounterpartyFromContext(context);

        // 3. Buscar template activo con prioridad por contraparte
        const template = await getActiveTemplate(actType, counterpartyName || undefined);

        // 4. Bajar .docx de storage como Buffer
        const templateBuffer = await downloadTemplate(template.docx_path);

        // 5. Aplicar overrides (ej: datos que completa el escribano al firmar)
        if (contextOverrides) {
            for (const [key, value] of Object.entries(contextOverrides)) {
                if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                    context[key] = { ...(context[key] as Record<string, unknown> || {}), ...value as Record<string, unknown> };
                } else {
                    context[key] = value;
                }
            }
        }

        // 6. Renderizar DOCX con docxtemplater (JS — no requiere Python)
        const renderedBuffer = renderDocx(templateBuffer, context);

        // 6. Convertir a HTML para preview en el navegador
        const htmlPreview = await generateHtmlPreview(renderedBuffer);

        // 7. Subir a storage
        const storagePath = `carpetas/${carpetaId}/escritura_${actType}_${Date.now()}.docx`;
        await uploadDocxToStorage(renderedBuffer, storagePath);

        // 8. Generar URL firmada (1 hora)
        const downloadUrl = await createSignedUrl(storagePath);

        return {
            success: true,
            downloadUrl: downloadUrl || undefined,
            storagePath,
            htmlPreview,
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

// ---------------------------------------------------------------------------
// loadRenderedDocument — Checks storage for an already-rendered DOCX and
// returns its signed URL + HTML preview.  Used to persist across reloads.
// ---------------------------------------------------------------------------

export async function loadRenderedDocument(
    carpetaId: string,
    actType: string
): Promise<RenderResult> {
    try {
        const prefix = `carpetas/${carpetaId}/`;
        const { data: files, error: listErr } = await supabaseAdmin.storage
            .from("escrituras")
            .list(prefix.replace(/\/$/, ""), { limit: 100 });

        if (listErr || !files) {
            return { success: false, error: listErr?.message || "No files" };
        }

        // Find the most recent rendered DOCX matching the act type
        const pattern = new RegExp(`^escritura_${actType}_(\\d+)\\.docx$`);
        const matches = files
            .filter((f) => pattern.test(f.name))
            .sort((a, b) => {
                const tsA = Number(pattern.exec(a.name)?.[1] || 0);
                const tsB = Number(pattern.exec(b.name)?.[1] || 0);
                return tsB - tsA; // newest first
            });

        if (matches.length === 0) {
            return { success: false, error: "No rendered document found" };
        }

        const storagePath = `${prefix}${matches[0].name}`;

        // Download to generate HTML preview
        const { data: blob, error: dlErr } = await supabaseAdmin.storage
            .from("escrituras")
            .download(storagePath);

        if (dlErr || !blob) {
            return { success: false, error: dlErr?.message || "Download failed" };
        }

        const docxBuffer = Buffer.from(await blob.arrayBuffer());
        const htmlPreview = await generateHtmlPreview(docxBuffer);
        const downloadUrl = await createSignedUrl(storagePath);

        return {
            success: true,
            downloadUrl: downloadUrl || undefined,
            storagePath,
            htmlPreview,
        };
    } catch (error: any) {
        console.error("[loadRenderedDocument] Error:", error);
        return { success: false, error: error.message };
    }
}
