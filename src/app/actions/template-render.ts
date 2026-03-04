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
import mammoth from "mammoth";

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

    const rawBuffer = Buffer.from(
        doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" })
    );

    // Strip font colors from the rendered DOCX
    return stripColorsFromDocx(rawBuffer);
}

// ---------------------------------------------------------------------------
// stripColorsFromDocx — remove <w:color> and <w:highlight> from document XML
// so the generated DOCX has uniform black text instead of coloured placeholders
// ---------------------------------------------------------------------------

function stripColorsFromDocx(docxBuffer: Buffer): Buffer {
    const zip = new PizZip(docxBuffer);

    // Process all document XML parts (main doc + headers/footers)
    const xmlParts = [
        "word/document.xml",
        "word/header1.xml", "word/header2.xml", "word/header3.xml",
        "word/footer1.xml", "word/footer2.xml", "word/footer3.xml",
    ];

    for (const partName of xmlParts) {
        const file = zip.file(partName);
        if (!file) continue;
        let xml = file.asText();

        // Remove <w:color w:val="XXXXXX"/> elements (any colour)
        xml = xml.replace(/<w:color\s+[^/]*\/>/gi, "");
        // Remove <w:color ...>...</w:color> (shouldn't exist, but just in case)
        xml = xml.replace(/<w:color\b[^>]*>[\s\S]*?<\/w:color>/gi, "");

        // Remove <w:highlight w:val="..."/> (coloured background)
        xml = xml.replace(/<w:highlight\s+[^/]*\/>/gi, "");

        // Remove <w:shd> with colour on run-level (character shading)
        // Keep paragraph-level shading (<w:pPr><w:shd>) intact
        xml = xml.replace(/(<w:rPr[^>]*>)((?:(?!<\/w:rPr>)[\s\S])*?)(<w:shd\s+[^/]*\/>)/gi, "$1$2");

        zip.file(partName, xml);
    }

    return Buffer.from(zip.generate({ type: "nodebuffer", compression: "DEFLATE" }));
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

        // 6. Convertir a HTML para preview en el navegador
        let htmlPreview = "";
        try {
            const mammothResult = await mammoth.convertToHtml(
                { buffer: renderedBuffer },
                {
                    styleMap: [
                        "b => strong",
                        "i => em",
                        "u => u",
                    ],
                }
            );
            htmlPreview = mammothResult.value;
        } catch (e) {
            console.warn("[renderTemplate] mammoth preview failed:", e);
        }

        // 7. Subir a storage
        const storagePath = await uploadRendered(renderedBuffer, carpetaId, actType);

        // 8. Generar URL firmada (1 hora)
        const { data: signedUrl } = await supabaseAdmin.storage
            .from("escrituras")
            .createSignedUrl(storagePath, 3600);

        return {
            success: true,
            downloadUrl: signedUrl?.signedUrl || undefined,
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

        let htmlPreview = "";
        try {
            const mammothResult = await mammoth.convertToHtml(
                { buffer: docxBuffer },
                { styleMap: ["b => strong", "i => em", "u => u"] }
            );
            htmlPreview = mammothResult.value;
        } catch (e) {
            console.warn("[loadRenderedDocument] mammoth failed:", e);
        }

        const { data: signedUrl } = await supabaseAdmin.storage
            .from("escrituras")
            .createSignedUrl(storagePath, 3600);

        return {
            success: true,
            downloadUrl: signedUrl?.signedUrl || undefined,
            storagePath,
            htmlPreview,
        };
    } catch (error: any) {
        console.error("[loadRenderedDocument] Error:", error);
        return { success: false, error: error.message };
    }
}
