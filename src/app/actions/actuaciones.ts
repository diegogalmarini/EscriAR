"use server";

import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireOrgMembership } from "@/lib/auth/getOrg";
import { buildTemplateContext } from "@/lib/templates/buildTemplateContext";
import {
    getActiveTemplate,
    downloadTemplate,
    renderDocx,
    generateHtmlPreview,
    uploadDocxToStorage,
    createSignedUrl,
} from "@/lib/templates/docxRenderer";
import type { Actuacion } from "./actuaciones-types";

// ---------------------------------------------------------------------------
// getActuaciones — lista todas las actuaciones de una carpeta
// ---------------------------------------------------------------------------

export async function getActuaciones(
    carpetaId: string
): Promise<{ success: boolean; data?: Actuacion[]; error?: string }> {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("actuaciones")
            .select("*")
            .eq("carpeta_id", carpetaId)
            .order("created_at", { ascending: true });

        if (error) throw error;
        return { success: true, data: data as Actuacion[] };
    } catch (error: any) {
        console.error("[getActuaciones] Error:", error);
        return { success: false, error: error.message };
    }
}

// ---------------------------------------------------------------------------
// createActuacion — crea una actuación en estado DRAFT
// ---------------------------------------------------------------------------

export async function createActuacion(
    carpetaId: string,
    actType: string,
    categoria: "PRIVADO" | "PROTOCOLAR",
    operacionId?: string | null
): Promise<{ success: boolean; data?: Actuacion; error?: string }> {
    try {
        const { orgId, userId } = await requireOrgMembership();
        const supabase = await createClient();

        const { data, error } = await supabase
            .from("actuaciones")
            .insert({
                org_id: orgId,
                carpeta_id: carpetaId,
                operacion_id: operacionId || null,
                categoria,
                act_type: actType,
                status: "DRAFT",
                created_by: userId,
            })
            .select()
            .single();

        if (error) throw error;
        return { success: true, data: data as Actuacion };
    } catch (error: any) {
        console.error("[createActuacion] Error:", error);
        return { success: false, error: error.message };
    }
}

// ---------------------------------------------------------------------------
// generateActuacion — pipeline completo: DRAFT/ERROR → GENERANDO → LISTO
// ---------------------------------------------------------------------------

export async function generateActuacion(
    actuacionId: string
): Promise<{ success: boolean; data?: Actuacion; error?: string }> {
    try {
        const supabase = await createClient();

        // 1. Obtener actuación
        const { data: actuacion, error: fetchErr } = await supabase
            .from("actuaciones")
            .select("*")
            .eq("id", actuacionId)
            .single();

        if (fetchErr || !actuacion) {
            throw new Error(`Actuación no encontrada: ${fetchErr?.message}`);
        }

        // 2. Marcar como GENERANDO
        await supabase
            .from("actuaciones")
            .update({ status: "GENERANDO", metadata: { ...actuacion.metadata, last_generation_start: new Date().toISOString() } })
            .eq("id", actuacionId);

        try {
            // 3. Buscar template activo
            const template = await getActiveTemplate(actuacion.act_type);

            // 4. Bajar template DOCX
            const templateBuffer = await downloadTemplate(template.docx_path);

            // 5. Construir contexto desde datos de la carpeta
            const context = await buildTemplateContext(actuacion.carpeta_id) as unknown as Record<string, unknown>;

            // 6. Renderizar DOCX
            const renderedBuffer = renderDocx(templateBuffer, context);

            // 7. HTML preview
            const htmlPreview = await generateHtmlPreview(renderedBuffer);

            // 8. Subir a storage
            const storagePath = `carpetas/${actuacion.carpeta_id}/actuaciones/${actuacionId}.docx`;
            await uploadDocxToStorage(renderedBuffer, storagePath);

            // 9. Snapshot del contexto de generación (fuentes)
            const generationContext = {
                template_id: template.id,
                template_version: template.version,
                act_type: actuacion.act_type,
                generated_at: new Date().toISOString(),
                // Resumen de fuentes usadas (sin datos sensibles completos)
                sources: {
                    vendedores: (context.vendedores as any[])?.map((v: any) => v.nombre_completo).filter(Boolean) || [],
                    compradores: (context.compradores as any[])?.map((c: any) => c.nombre_completo).filter(Boolean) || [],
                    inmueble: (context.inmueble as any)?.partido || null,
                    monto: (context.operacion as any)?.precio_venta || null,
                },
            };

            // 10. Actualizar actuación a LISTO
            const { data: updated, error: updErr } = await supabase
                .from("actuaciones")
                .update({
                    status: "LISTO",
                    docx_path: storagePath,
                    html_preview: htmlPreview,
                    modelo_id: template.id,
                    generation_context: generationContext,
                    metadata: {
                        ...actuacion.metadata,
                        last_generation_end: new Date().toISOString(),
                        template_name: template.template_name,
                        total_variables: template.total_variables,
                    },
                })
                .eq("id", actuacionId)
                .select()
                .single();

            if (updErr) throw updErr;
            return { success: true, data: updated as Actuacion };

        } catch (genError: any) {
            // Error en generación → marcar como ERROR
            console.error("[generateActuacion] Generation failed:", genError);
            await supabase
                .from("actuaciones")
                .update({
                    status: "ERROR",
                    metadata: {
                        ...actuacion.metadata,
                        last_error: genError.message,
                        last_error_at: new Date().toISOString(),
                    },
                })
                .eq("id", actuacionId);

            return { success: false, error: genError.message };
        }
    } catch (error: any) {
        console.error("[generateActuacion] Error:", error);
        return { success: false, error: error.message };
    }
}

// ---------------------------------------------------------------------------
// deleteActuacion — elimina actuación y su archivo de storage
// ---------------------------------------------------------------------------

export async function deleteActuacion(
    actuacionId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await requireOrgMembership();

        // Obtener actuación para limpiar storage + resetear tipo_acto
        const { data: actuacion } = await supabaseAdmin
            .from("actuaciones")
            .select("docx_path, act_type, carpeta_id")
            .eq("id", actuacionId)
            .single();

        if (actuacion?.docx_path) {
            const { error: storageErr } = await supabaseAdmin.storage
                .from("escrituras")
                .remove([actuacion.docx_path]);
            if (storageErr) {
                console.warn("[deleteActuacion] Error borrando archivo:", storageErr.message);
            }
        }

        // Usar admin para bypasear RLS
        const { error } = await supabaseAdmin
            .from("actuaciones")
            .delete()
            .eq("id", actuacionId);

        if (error) throw error;

        // Si el act_type coincide con el tipo_acto de la operación TRAMITE, resetearlo
        if (actuacion?.act_type && actuacion?.carpeta_id) {
            const { data: tramiteEsc } = await supabaseAdmin
                .from("escrituras")
                .select("operaciones(id, tipo_acto)")
                .eq("carpeta_id", actuacion.carpeta_id)
                .eq("source", "TRAMITE")
                .maybeSingle();

            const op = (tramiteEsc as any)?.operaciones?.[0];
            if (op && op.tipo_acto === actuacion.act_type) {
                await supabaseAdmin
                    .from("operaciones")
                    .update({ tipo_acto: "POR_DEFINIR", codigo: null })
                    .eq("id", op.id);
            }
        }

        return { success: true };
    } catch (error: any) {
        console.error("[deleteActuacion] Error:", error);
        return { success: false, error: error.message };
    }
}

// ---------------------------------------------------------------------------
// getActuacionDownloadUrl — genera URL firmada para descarga (1h)
// ---------------------------------------------------------------------------

export async function getActuacionDownloadUrl(
    actuacionId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
        const supabase = await createClient();

        const { data: actuacion } = await supabase
            .from("actuaciones")
            .select("docx_path")
            .eq("id", actuacionId)
            .single();

        if (!actuacion?.docx_path) {
            return { success: false, error: "No hay archivo generado" };
        }

        const url = await createSignedUrl(actuacion.docx_path);
        if (!url) {
            return { success: false, error: "No se pudo generar URL de descarga" };
        }

        return { success: true, url };
    } catch (error: any) {
        console.error("[getActuacionDownloadUrl] Error:", error);
        return { success: false, error: error.message };
    }
}
