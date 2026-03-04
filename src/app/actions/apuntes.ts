"use server";

import { createClient } from "@/lib/supabaseServer";
import { requireOrgMembership } from "@/lib/auth/getOrg";
import { revalidatePath } from "next/cache";

export async function createApunte(carpetaId: string, contenido: string) {
    try {
        const { orgId, userId } = await requireOrgMembership();
        const supabase = await createClient();

        // 1. Crear apunte con ia_status = PROCESANDO
        const { data, error } = await supabase
            .from("apuntes")
            .insert({
                org_id: orgId,
                carpeta_id: carpetaId,
                contenido: contenido.trim(),
                origen: "texto",
                autor_id: userId,
                ia_status: "PROCESANDO",
            })
            .select()
            .single();

        if (error) throw error;

        // 2. Crear job NOTE_ANALYSIS en ingestion_jobs
        const { error: jobError } = await supabase
            .from("ingestion_jobs")
            .insert({
                user_id: userId,
                carpeta_id: carpetaId,
                org_id: orgId,
                job_type: "NOTE_ANALYSIS",
                status: "pending",
                entity_ref: { apunte_id: data.id },
                payload: {
                    note_text_preview: contenido.trim().substring(0, 200),
                    version: 1,
                },
            });

        if (jobError) {
            console.error("Error creating NOTE_ANALYSIS job:", jobError);
            // No falla el apunte, pero marca como error
            await supabase
                .from("apuntes")
                .update({ ia_status: "ERROR", ia_last_error: "No se pudo encolar análisis" })
                .eq("id", data.id);
        }

        revalidatePath(`/carpeta/${carpetaId}`);
        return { success: true, apunte: data };
    } catch (err: any) {
        console.error("Error creating apunte:", err);
        return { success: false, error: err.message };
    }
}

export async function listApuntes(carpetaId: string) {
    try {
        await requireOrgMembership();
        const supabase = await createClient();

        const { data, error } = await supabase
            .from("apuntes")
            .select("*")
            .eq("carpeta_id", carpetaId)
            .order("created_at", { ascending: false });

        if (error) throw error;
        return { success: true, apuntes: data || [] };
    } catch (err: any) {
        console.error("Error listing apuntes:", err);
        return { success: false, error: err.message, apuntes: [] };
    }
}

export async function updateApunte(apunteId: string, contenido: string) {
    try {
        await requireOrgMembership();
        const supabase = await createClient();

        const { error } = await supabase
            .from("apuntes")
            .update({ contenido: contenido.trim() })
            .eq("id", apunteId);

        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error("Error updating apunte:", err);
        return { success: false, error: err.message };
    }
}

export async function deleteApunte(apunteId: string) {
    try {
        await requireOrgMembership();
        const supabase = await createClient();

        const { error } = await supabase
            .from("apuntes")
            .delete()
            .eq("id", apunteId);

        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error("Error deleting apunte:", err);
        return { success: false, error: err.message };
    }
}

export async function retryNoteAnalysis(apunteId: string, carpetaId: string) {
    try {
        const { orgId, userId } = await requireOrgMembership();
        const supabase = await createClient();

        // 1. Marcar apunte como PROCESANDO
        const { error: updateError } = await supabase
            .from("apuntes")
            .update({ ia_status: "PROCESANDO", ia_last_error: null })
            .eq("id", apunteId);

        if (updateError) throw updateError;

        // 2. Obtener contenido del apunte
        const { data: apunte, error: fetchError } = await supabase
            .from("apuntes")
            .select("contenido")
            .eq("id", apunteId)
            .single();

        if (fetchError) throw fetchError;

        // 3. Crear nuevo job NOTE_ANALYSIS
        const { error: jobError } = await supabase
            .from("ingestion_jobs")
            .insert({
                user_id: userId,
                carpeta_id: carpetaId,
                org_id: orgId,
                job_type: "NOTE_ANALYSIS",
                status: "pending",
                entity_ref: { apunte_id: apunteId },
                payload: {
                    note_text_preview: apunte.contenido.substring(0, 200),
                    version: 1,
                },
            });

        if (jobError) throw jobError;

        revalidatePath(`/carpeta/${carpetaId}`);
        return { success: true };
    } catch (err: any) {
        console.error("Error retrying note analysis:", err);
        return { success: false, error: err.message };
    }
}
