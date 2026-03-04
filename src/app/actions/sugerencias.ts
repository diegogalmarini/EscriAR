"use server";

import { createClient } from "@/lib/supabaseServer";
import { requireOrgMembership } from "@/lib/auth/getOrg";
import { revalidatePath } from "next/cache";

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
        const { userId } = await requireOrgMembership();
        const supabase = await createClient();

        const { error } = await supabase
            .from("sugerencias")
            .update({
                estado: "ACCEPTED",
                decided_by: userId,
                decided_at: new Date().toISOString(),
            })
            .eq("id", sugerenciaId);

        if (error) throw error;

        revalidatePath(`/carpeta/${carpetaId}`);
        return { success: true };
    } catch (err: any) {
        console.error("Error accepting sugerencia:", err);
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

        revalidatePath(`/carpeta/${carpetaId}`);
        return { success: true };
    } catch (err: any) {
        console.error("Error rejecting sugerencia:", err);
        return { success: false, error: err.message };
    }
}
