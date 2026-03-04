"use server";

import { createClient } from "@/lib/supabaseServer";
import { requireOrgMembership } from "@/lib/auth/getOrg";
import { revalidatePath } from "next/cache";

export async function createApunte(carpetaId: string, contenido: string) {
    try {
        const { orgId, userId } = await requireOrgMembership();
        const supabase = await createClient();

        const { data, error } = await supabase
            .from("apuntes")
            .insert({
                org_id: orgId,
                carpeta_id: carpetaId,
                contenido: contenido.trim(),
                origen: "texto",
                autor_id: userId,
            })
            .select()
            .single();

        if (error) throw error;

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
