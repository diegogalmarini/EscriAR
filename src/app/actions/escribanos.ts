"use server";

import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { revalidatePath } from "next/cache";

export type Escribano = {
    id: string;
    nombre_completo: string;
    caracter: 'TITULAR' | 'ADSCRIPTO' | 'INTERINO' | 'A_CARGO';
    numero_registro?: string;
    distrito_notarial?: string;
    matricula?: string;
    cuit?: string;
    domicilio_legal?: string;
    telefono?: string;
    email?: string;
    genero_titulo: 'ESCRIBANO' | 'ESCRIBANA' | 'NOTARIO' | 'NOTARIA';
    is_default: boolean;
    created_at?: string;
};

export async function getEscribanos() {
    try {
        const { data, error } = await supabaseAdmin
            .from("escribanos")
            .select("*")
            .order("nombre_completo", { ascending: true });

        if (error) throw error;
        return { success: true, data };
    } catch (error: any) {
        console.error("Error fetching escribanos:", error);
        return { success: false, error: error.message };
    }
}

export async function getDefaultEscribano() {
    try {
        const { data, error } = await supabaseAdmin
            .from("escribanos")
            .select("*")
            .eq("is_default", true)
            .maybeSingle();

        if (error) throw error;
        return { success: true, data };
    } catch (error: any) {
        console.error("Error fetching default escribano:", error);
        return { success: false, error: error.message };
    }
}

export async function createEscribano(data: Omit<Escribano, 'id' | 'is_default'>) {
    try {
        const { data: newEscribano, error } = await supabaseAdmin
            .from("escribanos")
            .insert([data])
            .select()
            .single();

        if (error) throw error;

        revalidatePath("/admin/users");
        return { success: true, data: newEscribano };
    } catch (error: any) {
        console.error("Error creating escribano:", error);
        return { success: false, error: error.message };
    }
}

export async function updateEscribano(id: string, data: Partial<Escribano>) {
    try {
        const { data: updated, error } = await supabaseAdmin
            .from("escribanos")
            .update(data)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;

        revalidatePath("/admin/users");
        return { success: true, data: updated };
    } catch (error: any) {
        console.error("Error updating escribano:", error);
        return { success: false, error: error.message };
    }
}

export async function deleteEscribano(id: string) {
    try {
        const { error } = await supabaseAdmin
            .from("escribanos")
            .delete()
            .eq("id", id);

        if (error) throw error;

        revalidatePath("/admin/users");
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting escribano:", error);
        return { success: false, error: error.message };
    }
}

export async function setDefaultEscribano(id: string) {
    try {
        const { error: unsetError } = await supabaseAdmin
            .from("escribanos")
            .update({ is_default: false })
            .eq("is_default", true);

        if (unsetError) throw unsetError;

        // 2. Set the new default
        const { data: updated, error: setError } = await supabaseAdmin
            .from("escribanos")
            .update({ is_default: true })
            .eq("id", id)
            .select()
            .single();

        if (setError) throw setError;

        revalidatePath("/admin/users");
        return { success: true, data: updated };
    } catch (error: any) {
        console.error("Error setting default escribano:", error);
        return { success: false, error: error.message };
    }
}
