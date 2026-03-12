"use server";

import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { type ModeloActo, SUPPORTED_ACT_TYPES } from "./modelos-types";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// List all modelos
// ---------------------------------------------------------------------------

export async function getModelos(instrumentCategory?: string): Promise<{ success: boolean; data?: ModeloActo[]; error?: string }> {
    try {
        const supabase = await createClient();
        let query = supabase
            .from("modelos_actos")
            .select("*")
            .order("act_type", { ascending: true })
            .order("version", { ascending: false });

        if (instrumentCategory) {
            query = query.eq("instrument_category", instrumentCategory);
        }

        const { data, error } = await query;

        if (error) {
            console.error("[getModelos] DB Error:", error);
            throw error;
        }
        return { success: true, data: data as ModeloActo[] };
    } catch (error: any) {
        console.error("[getModelos] Exception:", error);
        return { success: false, error: error.message || "Error al cargar modelos" };
    }
}

// ---------------------------------------------------------------------------
// Upload ZIP (template.docx + metadata.json)
// ---------------------------------------------------------------------------

export async function uploadModeloZip(
    formData: FormData
): Promise<{ success: boolean; data?: ModeloActo; error?: string }> {
    try {
        const file = formData.get("file") as File;
        const actTypeOverride = formData.get("act_type") as string | null;

        if (!file || file.size === 0) {
            return { success: false, error: "No se proporcion\u00f3 archivo" };
        }

        // 1. Read ZIP contents using JSZip-compatible approach
        const arrayBuffer = await file.arrayBuffer();
        const { entries, getEntry } = await parseZip(new Uint8Array(arrayBuffer));

        // 2. Validate ZIP contents
        const hasTemplate = entries.some(e => e.toLowerCase().endsWith("template.docx"));
        const hasMetadata = entries.some(e => e.toLowerCase().endsWith("metadata.json"));

        if (!hasTemplate) {
            return { success: false, error: "El ZIP no contiene template.docx" };
        }
        if (!hasMetadata) {
            return { success: false, error: "El ZIP no contiene metadata.json" };
        }

        // 3. Extract metadata.json
        const metadataEntry = entries.find(e => e.toLowerCase().endsWith("metadata.json"))!;
        const metadataBytes = await getEntry(metadataEntry);
        const metadataStr = new TextDecoder("utf-8").decode(metadataBytes);
        const metadata = JSON.parse(metadataStr);

        // Validate metadata schema
        if (!metadata.schema_version || !metadata.required_variables) {
            return { success: false, error: "metadata.json inv\u00e1lido: falta schema_version o required_variables" };
        }

        // 4. Determine act_type
        let actType = actTypeOverride || metadata.act_type;
        if (!actType || actType === "auto") {
            // Try to infer from template_name
            const name = (metadata.template_name || "").toLowerCase();
            const match = SUPPORTED_ACT_TYPES.find(t => name.includes(t.value));
            if (match) {
                actType = match.value;
            } else {
                return {
                    success: false,
                    error: 'No se pudo determinar el tipo de acto. El metadata tiene act_type="auto". Seleccion\u00e1 el tipo manualmente.',
                };
            }
        }

        // 5. Extract template.docx
        const templateEntry = entries.find(e => e.toLowerCase().endsWith("template.docx"))!;
        const templateBytes = await getEntry(templateEntry);

        // 6. Determine version (auto-increment)
        const supabase = await createClient();
        const { data: existingModels } = await supabase
            .from("modelos_actos")
            .select("id, version, is_active")
            .eq("act_type", actType)
            .order("version", { ascending: false })
            .limit(1);

        const currentVersion = existingModels?.[0]?.version || 0;
        const newVersion = currentVersion + 1;

        // 7. Archive previous active version
        if (existingModels && existingModels.length > 0) {
            const activeIds = existingModels.filter((m: any) => m.is_active).map((m: any) => m.id);
            if (activeIds.length > 0) {
                await supabase
                    .from("modelos_actos")
                    .update({ is_active: false })
                    .in("id", activeIds);
            }
        }

        // 8. Upload template.docx to Storage
        const storagePath = `modelos_actos/${actType}/v${newVersion}/template.docx`;
        const { error: uploadError } = await supabaseAdmin.storage
            .from("escrituras")
            .upload(storagePath, templateBytes, {
                contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                upsert: true,
            });

        if (uploadError) {
            throw new Error(`Error subiendo template a Storage: ${uploadError.message}`);
        }

        // 9. Extract act_code from metadata (Template Builder >= schema 1.1)
        const actCode: string | null = metadata.act_code || null;

        // 10. Insert record in modelos_actos
        const label = SUPPORTED_ACT_TYPES.find(t => t.value === actType)?.label || actType;

        const { data: inserted, error: insertError } = await supabase
            .from("modelos_actos")
            .insert({
                act_type: actType,
                act_code: actCode,
                template_name: metadata.template_name || `${actType}_template`,
                label: label,
                description: `Template v${newVersion}${metadata.schema_version ? ` (schema ${metadata.schema_version})` : ""}${actCode ? ` · Cód. ${actCode}` : ""} — ${metadata.total_variables || 0} variables en ${(metadata.categories_used || []).length} categorías`,
                instrument_category: (formData.get("instrument_category") as string) || "ESCRITURA_PUBLICA",
                version: newVersion,
                is_active: true,
                docx_path: storagePath,
                metadata: metadata,
                total_variables: metadata.total_variables || 0,
                categories: metadata.categories_used || [],
            })
            .select()
            .single();

        if (insertError) throw insertError;
        
        revalidatePath("/modelos");
        return { success: true, data: inserted as ModeloActo };
    } catch (error: any) {
        console.error("[uploadModeloZip] CRITICAL ERROR:", error);
        return { success: false, error: `Error interno al procesar el ZIP: ${error.message}` };
    }
}

// ---------------------------------------------------------------------------
// Toggle active/archive
// ---------------------------------------------------------------------------

export async function toggleModeloActive(
    modeloId: string,
    activate: boolean
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();

        if (activate) {
            // First get the modelo to know its act_type
            const { data: modelo } = await supabase
                .from("modelos_actos")
                .select("act_type")
                .eq("id", modeloId)
                .single();

            if (!modelo) return { success: false, error: "Modelo no encontrado" };

            // Deactivate all other models of same act_type
            await supabase
                .from("modelos_actos")
                .update({ is_active: false })
                .eq("act_type", modelo.act_type)
                .neq("id", modeloId);

            // Activate this one
            await supabase
                .from("modelos_actos")
                .update({ is_active: true })
                .eq("id", modeloId);
        } else {
            await supabase
                .from("modelos_actos")
                .update({ is_active: false })
                .eq("id", modeloId);
        }

        revalidatePath("/modelos");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ---------------------------------------------------------------------------
// Delete modelo
// ---------------------------------------------------------------------------

export async function deleteModelo(
    modeloId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();

        // Get docx_path to delete from storage
        const { data: modelo } = await supabase
            .from("modelos_actos")
            .select("docx_path")
            .eq("id", modeloId)
            .single();

        if (modelo?.docx_path) {
            const { error: storageError } = await supabaseAdmin.storage
                .from("escrituras")
                .remove([modelo.docx_path]);
            if (storageError) {
                console.error("[deleteModelo] Error borrando archivo de storage:", storageError);
            }
        }

        const { error } = await supabase
            .from("modelos_actos")
            .delete()
            .eq("id", modeloId);

        if (error) throw error;
        
        revalidatePath("/modelos");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ---------------------------------------------------------------------------
// ZIP parser using jszip
// ---------------------------------------------------------------------------

async function parseZip(data: Uint8Array): Promise<{
    entries: string[];
    getEntry: (name: string) => Promise<Uint8Array>;
}> {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(data);

    const entries = Object.keys(zip.files).filter((name) => !zip.files[name].dir);

    return {
        entries,
        getEntry: async (name: string) => {
            try {
                const file = zip.file(name);
                if (!file) throw new Error(`Entry "${name}" not found in ZIP`);
                return await file.async("uint8array");
            } catch (err: any) {
                console.error(`[parseZip] Error reading entry ${name}:`, err);
                throw err;
            }
        },
    };
}
