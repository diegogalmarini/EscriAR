"use server";

import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildTemplateContext } from "@/lib/templates/buildTemplateContext";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

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
// downloadTemplate — baja el .docx de storage a un archivo temporal
// ---------------------------------------------------------------------------

async function downloadTemplate(docxPath: string): Promise<string> {
    const { data, error } = await supabaseAdmin.storage
        .from("escrituras")
        .download(docxPath);

    if (error || !data) {
        throw new Error(`No se pudo descargar template "${docxPath}": ${error?.message}`);
    }

    const tmpDir = path.join(os.tmpdir(), "notiar-templates");
    await fs.mkdir(tmpDir, { recursive: true });

    const tmpFile = path.join(tmpDir, `template-${Date.now()}.docx`);
    const buffer = Buffer.from(await data.arrayBuffer());
    await fs.writeFile(tmpFile, buffer);

    return tmpFile;
}

// ---------------------------------------------------------------------------
// renderDocx — llama a docxtpl via Python
// ---------------------------------------------------------------------------

async function renderDocx(templatePath: string, context: Record<string, unknown>): Promise<string> {
    const tmpDir = path.join(os.tmpdir(), "notiar-templates");
    const outputPath = path.join(tmpDir, `output-${Date.now()}.docx`);
    const contextPath = path.join(tmpDir, `context-${Date.now()}.json`);

    // Escribir context como archivo JSON (evita problemas de escaping en CLI)
    await fs.writeFile(contextPath, JSON.stringify(context, null, 2), "utf-8");

    // Script Python inline que lee el JSON de un archivo
    const pythonScript = `
import sys, json
from docxtpl import DocxTemplate
template_path = sys.argv[1]
output_path = sys.argv[2]
context_path = sys.argv[3]
with open(context_path, 'r', encoding='utf-8') as f:
    context = json.load(f)
doc = DocxTemplate(template_path)
doc.render(context)
doc.save(output_path)
print("OK")
`.trim();

    const scriptPath = path.join(tmpDir, "render.py");
    await fs.writeFile(scriptPath, pythonScript, "utf-8");

    try {
        const { stdout, stderr } = await execAsync(
            `python "${scriptPath}" "${templatePath}" "${outputPath}" "${contextPath}"`,
            { timeout: 30000 }
        );

        if (stderr && !stdout.includes("OK")) {
            throw new Error(`Python docxtpl error: ${stderr}`);
        }

        return outputPath;
    } finally {
        // Cleanup temp files (except output)
        await fs.unlink(scriptPath).catch(() => {});
        await fs.unlink(contextPath).catch(() => {});
        await fs.unlink(templatePath).catch(() => {});
    }
}

// ---------------------------------------------------------------------------
// uploadRendered — sube el DOCX generado a storage
// ---------------------------------------------------------------------------

async function uploadRendered(localPath: string, carpetaId: string, actType: string): Promise<string> {
    const fileBuffer = await fs.readFile(localPath);
    const storagePath = `carpetas/${carpetaId}/escritura_${actType}_${Date.now()}.docx`;

    const { error } = await supabaseAdmin.storage
        .from("escrituras")
        .upload(storagePath, fileBuffer, {
            contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            upsert: true,
        });

    if (error) {
        throw new Error(`Error subiendo DOCX a storage: ${error.message}`);
    }

    // Cleanup local file
    await fs.unlink(localPath).catch(() => {});

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

        // 2. Bajar .docx de storage
        const templateLocalPath = await downloadTemplate(template.docx_path);

        // 3. Construir context desde BD
        const context = await buildTemplateContext(carpetaId) as unknown as Record<string, unknown>;

        // 4. Aplicar overrides (ej: datos que completa el escribano al firmar)
        if (contextOverrides) {
            for (const [key, value] of Object.entries(contextOverrides)) {
                if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                    // Merge profundo para objetos (ej: escritura.folio)
                    context[key] = { ...(context[key] as Record<string, unknown> || {}), ...value as Record<string, unknown> };
                } else {
                    context[key] = value;
                }
            }
        }

        // 5. Renderizar DOCX con docxtpl
        const outputPath = await renderDocx(templateLocalPath, context);

        // 6. Subir a storage
        const storagePath = await uploadRendered(outputPath, carpetaId, actType);

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
