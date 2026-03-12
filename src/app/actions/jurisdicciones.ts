"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { revalidatePath } from "next/cache";

export type Jurisdiccion = {
    id: string;
    jurisdiction_id: string;
    version: string;
    party_name: string;
    party_code: string;
    delegation_code: string;
    aliases: string[];
    active: boolean;
    org_id: string | null;
    created_at: string;
};

export async function getJurisdicciones() {
    try {
        const { data, error } = await supabaseAdmin
            .from("jurisdicciones")
            .select("*")
            .order("party_name", { ascending: true });

        if (error) throw error;
        return { success: true, data: data as Jurisdiccion[] };
    } catch (error: any) {
        console.error("[getJurisdicciones]", error);
        return { success: false, error: error.message || "Error al cargar jurisdicciones" };
    }
}

export async function getJurisdiccionStats() {
    try {
        const { data, error } = await supabaseAdmin
            .from("jurisdicciones")
            .select("jurisdiction_id, active");

        if (error) throw error;

        const items = data || [];
        const total = items.length;
        const activas = items.filter((j: any) => j.active).length;
        const provincias = [...new Set(items.map((j: any) => j.jurisdiction_id))];

        return {
            success: true,
            data: { total, activas, inactivas: total - activas, provincias }
        };
    } catch (error: any) {
        console.error("[getJurisdiccionStats]", error);
        return { success: false, error: error.message };
    }
}

export async function createJurisdiccion(data: {
    jurisdiction_id: string;
    version: string;
    party_name: string;
    party_code: string;
    delegation_code: string;
    aliases: string[];
}) {
    try {
        const { data: created, error } = await supabaseAdmin
            .from("jurisdicciones")
            .insert([{ ...data, active: true }])
            .select()
            .single();

        if (error) throw error;

        revalidatePath("/jurisdicciones");
        return { success: true, data: created };
    } catch (error: any) {
        console.error("[createJurisdiccion]", error);
        return { success: false, error: error.message };
    }
}

export async function updateJurisdiccion(id: string, data: Partial<Jurisdiccion>) {
    try {
        const { data: updated, error } = await supabaseAdmin
            .from("jurisdicciones")
            .update(data)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;

        revalidatePath("/jurisdicciones");
        return { success: true, data: updated };
    } catch (error: any) {
        console.error("[updateJurisdiccion]", error);
        return { success: false, error: error.message };
    }
}

export async function deleteJurisdiccion(id: string) {
    try {
        const { error } = await supabaseAdmin
            .from("jurisdicciones")
            .delete()
            .eq("id", id);

        if (error) throw error;

        revalidatePath("/jurisdicciones");
        return { success: true };
    } catch (error: any) {
        console.error("[deleteJurisdiccion]", error);
        return { success: false, error: error.message };
    }
}

export async function toggleJurisdiccionActive(id: string, active: boolean) {
    try {
        const { error } = await supabaseAdmin
            .from("jurisdicciones")
            .update({ active })
            .eq("id", id);

        if (error) throw error;

        revalidatePath("/jurisdicciones");
        return { success: true };
    } catch (error: any) {
        console.error("[toggleJurisdiccionActive]", error);
        return { success: false, error: error.message };
    }
}

export async function toggleBulkActive(jurisdictionId: string, active: boolean) {
    try {
        const { error } = await supabaseAdmin
            .from("jurisdicciones")
            .update({ active })
            .eq("jurisdiction_id", jurisdictionId);

        if (error) throw error;

        revalidatePath("/jurisdicciones");
        return { success: true };
    } catch (error: any) {
        console.error("[toggleBulkActive]", error);
        return { success: false, error: error.message };
    }
}
