"use server";

import { createClient } from "@/lib/supabaseServer";
import { getUserOrgId } from "@/lib/auth/getOrg";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Borrador {
    id: string;
    tipo: "DOCUMENTO" | "PRESUPUESTO";
    nombre: string;
    instrument_category: string | null;
    act_type: string | null;
    contenido: string | null;
    metadata: any;
    modelo_id: string | null;
    carpeta_id: string | null;
    author_id: string;
    org_id: string;
    created_at: string;
    updated_at: string;
}

// ---------------------------------------------------------------------------
// List borradores for current org
// ---------------------------------------------------------------------------

export async function getBorradores(): Promise<{ success: boolean; data?: Borrador[]; error?: string }> {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from("borradores")
            .select("*")
            .is("carpeta_id", null)
            .order("updated_at", { ascending: false });

        if (error) throw error;
        return { success: true, data: data as Borrador[] };
    } catch (error: any) {
        console.error("[getBorradores]", error);
        return { success: false, error: error.message };
    }
}

// ---------------------------------------------------------------------------
// Create borrador
// ---------------------------------------------------------------------------

export async function createBorrador(params: {
    tipo: "DOCUMENTO" | "PRESUPUESTO";
    nombre?: string;
    instrument_category?: string | null;
    act_type?: string | null;
    contenido?: string | null;
    metadata?: any;
    modelo_id?: string | null;
}): Promise<{ success: boolean; data?: Borrador; error?: string }> {
    try {
        const supabase = await createClient();
        const orgId = await getUserOrgId();
        if (!orgId) return { success: false, error: "No pertenece a ninguna organización" };

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "No autenticado" };

        const { data, error } = await supabase
            .from("borradores")
            .insert({
                tipo: params.tipo,
                nombre: params.nombre || "Sin título",
                instrument_category: params.instrument_category || null,
                act_type: params.act_type || null,
                contenido: params.contenido || null,
                metadata: params.metadata || {},
                modelo_id: params.modelo_id || null,
                author_id: user.id,
                org_id: orgId,
            })
            .select()
            .single();

        if (error) throw error;
        revalidatePath("/dashboard");
        return { success: true, data: data as Borrador };
    } catch (error: any) {
        console.error("[createBorrador]", error);
        return { success: false, error: error.message };
    }
}

// ---------------------------------------------------------------------------
// Delete borrador
// ---------------------------------------------------------------------------

export async function deleteBorrador(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient();
        const { error } = await supabase
            .from("borradores")
            .delete()
            .eq("id", id);

        if (error) throw error;
        revalidatePath("/dashboard");
        return { success: true };
    } catch (error: any) {
        console.error("[deleteBorrador]", error);
        return { success: false, error: error.message };
    }
}
