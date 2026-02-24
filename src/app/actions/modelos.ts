"use server";

import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModeloActo {
    id: string;
    act_type: string;
    template_name: string;
    label: string | null;
    description: string | null;
    instrument_category: string;
    version: number;
    is_active: boolean;
    docx_path: string;
    metadata: any;
    total_variables: number;
    categories: string[];
    created_at: string;
    updated_at: string;
}

/** Actos soportados para el dropdown cuando act_type viene como "auto" */
export const SUPPORTED_ACT_TYPES = [
    { value: "compraventa", label: "Compraventa" },
    { value: "hipoteca", label: "Hipoteca" },
    { value: "donacion", label: "Donaci\u00f3n" },
    { value: "cancelacion_hipoteca", label: "Cancelaci\u00f3n de Hipoteca" },
    { value: "cesion_derechos", label: "Cesi\u00f3n de Derechos" },
    { value: "usufructo", label: "Usufructo" },
    { value: "afectacion_vivienda", label: "Afectaci\u00f3n a Vivienda" },
    { value: "division_condominio", label: "Divisi\u00f3n de Condominio" },
    { value: "fideicomiso", label: "Fideicomiso" },
    { value: "poder", label: "Poder" },
    { value: "constitucion_sociedad", label: "Constituci\u00f3n de Sociedad" },
    { value: "declaratoria_herederos", label: "Declaratoria de Herederos" },
    { value: "testamento", label: "Testamento" },
    { value: "permuta", label: "Permuta" },
    { value: "dacion_en_pago", label: "Daci\u00f3n en Pago" },
    { value: "servidumbre", label: "Servidumbre" },
    { value: "reglamento_ph", label: "Reglamento PH" },
    { value: "autorizacion_vehicular", label: "Autorización Vehicular / a Conducir" },
    { value: "protocolizacion", label: "Protocolización" },
    { value: "certificacion_firmas", label: "Certificación de Firmas" },
    { value: "acta_constatacion", label: "Acta de Constatación" },
] as const;

// ---------------------------------------------------------------------------
// List all modelos
// ---------------------------------------------------------------------------

export async function getModelos(): Promise<{ success: boolean; data?: ModeloActo[]; error?: string }> {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("modelos_actos")
            .select("*")
            .order("act_type", { ascending: true })
            .order("version", { ascending: false });

        if (error) throw error;
        return { success: true, data: data as ModeloActo[] };
    } catch (error: any) {
        return { success: false, error: error.message };
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
            const activeIds = existingModels.filter(m => m.is_active).map(m => m.id);
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

        // 9. Insert record in modelos_actos
        const label = SUPPORTED_ACT_TYPES.find(t => t.value === actType)?.label || actType;

        const { data: inserted, error: insertError } = await supabase
            .from("modelos_actos")
            .insert({
                act_type: actType,
                template_name: metadata.template_name || `${actType}_template`,
                label: label,
                description: `Template v${newVersion} — ${metadata.total_variables || 0} variables en ${(metadata.categories_used || []).length} categor\u00edas`,
                instrument_category: "ESCRITURA_PUBLICA",
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

        return { success: true, data: inserted as ModeloActo };
    } catch (error: any) {
        console.error("[uploadModeloZip]", error);
        return { success: false, error: error.message };
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
            await supabaseAdmin.storage
                .from("escrituras")
                .remove([modelo.docx_path]);
        }

        const { error } = await supabase
            .from("modelos_actos")
            .delete()
            .eq("id", modeloId);

        if (error) throw error;
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
            const file = zip.file(name);
            if (!file) throw new Error(`Entry "${name}" not found in ZIP`);
            return file.async("uint8array");
        },
    };
}
