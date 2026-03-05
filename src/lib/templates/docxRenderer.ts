// ---------------------------------------------------------------------------
// Funciones compartidas de rendering DOCX
// Extraídas de template-render.ts para reutilización en actuaciones.ts
// NO es "use server" — estas son funciones puras que se importan desde server actions
// ---------------------------------------------------------------------------

import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// @ts-ignore — no types for docxtemplater / pizzip / angular-expressions
import Docxtemplater from "docxtemplater";
// @ts-ignore
import PizZip from "pizzip";
// @ts-ignore
import expressionParser from "docxtemplater/expressions.js";
import mammoth from "mammoth";

// ---------------------------------------------------------------------------
// getActiveTemplate — busca el template activo para un act_type
// ---------------------------------------------------------------------------

export async function getActiveTemplate(actType: string) {
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

export async function downloadTemplate(docxPath: string): Promise<Buffer> {
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

export function renderDocx(templateBuffer: Buffer, context: Record<string, unknown>): Buffer {
    const zip = new PizZip(templateBuffer);

    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: "{{", end: "}}" },
        parser: expressionParser,
        nullGetter() {
            return "";
        },
    });

    doc.render(context);

    const rawBuffer = Buffer.from(
        doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" })
    );

    return stripColorsFromDocx(rawBuffer);
}

// ---------------------------------------------------------------------------
// stripColorsFromDocx — remove <w:color> and <w:highlight> from document XML
// ---------------------------------------------------------------------------

export function stripColorsFromDocx(docxBuffer: Buffer): Buffer {
    const zip = new PizZip(docxBuffer);

    const xmlParts = [
        "word/document.xml",
        "word/header1.xml", "word/header2.xml", "word/header3.xml",
        "word/footer1.xml", "word/footer2.xml", "word/footer3.xml",
    ];

    for (const partName of xmlParts) {
        const file = zip.file(partName);
        if (!file) continue;
        let xml = file.asText();

        xml = xml.replace(/<w:color\s+[^/]*\/>/gi, "");
        xml = xml.replace(/<w:color\b[^>]*>[\s\S]*?<\/w:color>/gi, "");
        xml = xml.replace(/<w:highlight\s+[^/]*\/>/gi, "");
        xml = xml.replace(/(<w:rPr[^>]*>)((?:(?!<\/w:rPr>)[\s\S])*?)(<w:shd\s+[^/]*\/>)/gi, "$1$2");

        zip.file(partName, xml);
    }

    return Buffer.from(zip.generate({ type: "nodebuffer", compression: "DEFLATE" }));
}

// ---------------------------------------------------------------------------
// generateHtmlPreview — convierte DOCX a HTML con mammoth
// ---------------------------------------------------------------------------

export async function generateHtmlPreview(docxBuffer: Buffer): Promise<string> {
    try {
        const mammothResult = await mammoth.convertToHtml(
            { buffer: docxBuffer },
            {
                styleMap: [
                    "b => strong",
                    "i => em",
                    "u => u",
                ],
            }
        );
        return mammothResult.value;
    } catch (e) {
        console.warn("[generateHtmlPreview] mammoth failed:", e);
        return "";
    }
}

// ---------------------------------------------------------------------------
// uploadDocxToStorage — sube un DOCX a storage en la ruta indicada
// ---------------------------------------------------------------------------

export async function uploadDocxToStorage(docxBuffer: Buffer, storagePath: string): Promise<void> {
    const { error } = await supabaseAdmin.storage
        .from("escrituras")
        .upload(storagePath, docxBuffer, {
            contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            upsert: true,
        });

    if (error) {
        throw new Error(`Error subiendo DOCX a storage: ${error.message}`);
    }
}

// ---------------------------------------------------------------------------
// createSignedUrl — genera URL firmada para un archivo en storage
// ---------------------------------------------------------------------------

export async function createSignedUrl(storagePath: string, expiresIn = 3600): Promise<string | null> {
    const { data } = await supabaseAdmin.storage
        .from("escrituras")
        .createSignedUrl(storagePath, expiresIn);

    return data?.signedUrl || null;
}
