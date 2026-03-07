"use server";

import { createClient } from "@/lib/supabaseServer";
import { requireOrgMembership } from "@/lib/auth/getOrg";
import { revalidatePath } from "next/cache";
import { applySuggestion } from "@/lib/deterministic/applySuggestion";
import { logAuditEvent } from "@/lib/logger";

export async function listSugerencias(carpetaId: string) {
    try {
        await requireOrgMembership();
        const supabase = await createClient();

        const { data, error } = await supabase
            .from("sugerencias")
            .select("*")
            .eq("carpeta_id", carpetaId)
            .order("created_at", { ascending: false });

        if (error) throw error;
        return { success: true, sugerencias: data || [] };
    } catch (err: any) {
        console.error("Error listing sugerencias:", err);
        return { success: false, error: err.message, sugerencias: [] };
    }
}

export async function acceptSuggestion(sugerenciaId: string, carpetaId: string) {
    try {
        const { userId, orgId } = await requireOrgMembership();
        const supabase = await createClient();

        // 1. Leer sugerencia completa (incluyendo evidencia_texto para parseo)
        const { data: sug, error: fetchErr } = await supabase
            .from("sugerencias")
            .select("id, tipo, payload, estado, evidencia_texto")
            .eq("id", sugerenciaId)
            .single();

        if (fetchErr) throw fetchErr;
        if (sug.estado !== "PROPOSED") {
            return { success: false, error: "Sugerencia ya fue procesada" };
        }

        console.log(`[ET5] acceptSuggestion: tipo=${sug.tipo}, payload=${JSON.stringify(sug.payload)}, evidencia=${sug.evidencia_texto?.substring(0, 100)}`);

        // 2. Ejecutar motor determinístico
        const result = await applySuggestion(supabase, sug.tipo, sug.payload, {
            carpetaId,
            orgId,
            userId,
            evidenciaTexto: sug.evidencia_texto || undefined,
        });

        console.log(`[ET5] applySuggestion result: success=${result.success}, changes=${JSON.stringify(result.applied_changes)}, error=${result.error}`);

        // 3. Actualizar sugerencia con resultado + audit trail SIEMPRE
        const now = new Date().toISOString();
        const { error: updateErr } = await supabase
            .from("sugerencias")
            .update({
                estado: result.success ? "ACCEPTED" : "PROPOSED",
                decided_by: userId,
                decided_at: now,
                applied_at: now,
                applied_by: userId,
                applied_changes: result.applied_changes,
                apply_error: result.error || null,
            })
            .eq("id", sugerenciaId);

        if (updateErr) {
            console.error(`[ET5] Error actualizando sugerencia ${sugerenciaId}:`, updateErr.message);
            throw updateErr;
        }

        revalidatePath(`/carpeta/${carpetaId}`);

        logAuditEvent({
            action: "SUGGESTION_ACCEPTED",
            entityType: "sugerencia",
            entityId: sugerenciaId,
            carpetaId,
            summary: `Aceptó sugerencia tipo ${sug.tipo}`,
            metadata: { tipo: sug.tipo, applied_changes: result.applied_changes },
        });

        return {
            success: result.success,
            applied_changes: result.applied_changes,
            error: result.error,
        };
    } catch (err: any) {
        console.error("[ET5] Error en acceptSuggestion:", err);
        return { success: false, error: err.message };
    }
}

/** Acepta sugerencia con confirmación de sobreescritura de nombre (usuario ya confirmó en modal) */
export async function acceptSuggestionForced(sugerenciaId: string, carpetaId: string, mode: "update" | "keep" = "update") {
    try {
        const { userId, orgId } = await requireOrgMembership();
        const supabase = await createClient();

        const { data: sug, error: fetchErr } = await supabase
            .from("sugerencias")
            .select("id, tipo, payload, estado, evidencia_texto")
            .eq("id", sugerenciaId)
            .single();

        if (fetchErr) throw fetchErr;
        if (sug.estado !== "PROPOSED") {
            return { success: false, error: "Sugerencia ya fue procesada" };
        }

        const result = await applySuggestion(supabase, sug.tipo, sug.payload, {
            carpetaId,
            orgId,
            userId,
            evidenciaTexto: sug.evidencia_texto || undefined,
            forceUpdateName: mode === "update",
            keepExistingName: mode === "keep",
        });

        const now = new Date().toISOString();
        const { error: updateErr } = await supabase
            .from("sugerencias")
            .update({
                estado: result.success ? "ACCEPTED" : "PROPOSED",
                decided_by: userId,
                decided_at: now,
                applied_at: now,
                applied_by: userId,
                applied_changes: result.applied_changes,
                apply_error: result.error || null,
            })
            .eq("id", sugerenciaId);

        if (updateErr) throw updateErr;

        revalidatePath(`/carpeta/${carpetaId}`);
        return {
            success: result.success,
            applied_changes: result.applied_changes,
            error: result.error,
        };
    } catch (err: any) {
        console.error("[ET5] Error en acceptSuggestionForced:", err);
        return { success: false, error: err.message };
    }
}

export async function rejectSuggestion(sugerenciaId: string, carpetaId: string) {
    try {
        const { userId } = await requireOrgMembership();
        const supabase = await createClient();

        const { error } = await supabase
            .from("sugerencias")
            .update({
                estado: "REJECTED",
                decided_by: userId,
                decided_at: new Date().toISOString(),
            })
            .eq("id", sugerenciaId);

        if (error) throw error;

        logAuditEvent({
            action: "SUGGESTION_REJECTED",
            entityType: "sugerencia",
            entityId: sugerenciaId,
            carpetaId,
            summary: `Rechazó sugerencia`,
        });

        revalidatePath(`/carpeta/${carpetaId}`);
        return { success: true };
    } catch (err: any) {
        console.error("Error rejecting sugerencia:", err);
        return { success: false, error: err.message };
    }
}
