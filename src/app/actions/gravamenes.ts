"use server";

import { createClient } from "@/lib/supabaseServer";

export type TipoGravamen =
    | "EMBARGO"
    | "HIPOTECA"
    | "INHIBICION_GENERAL"
    | "BIEN_DE_FAMILIA"
    | "USUFRUCTO"
    | "LITIS"
    | "OTRO";

export type EstadoGravamen = "VIGENTE" | "LEVANTADO" | "CADUCO";

export interface Gravamen {
    id: string;
    carpeta_id: string;
    inmueble_id: string | null;
    persona_id: string | null;
    certificado_id: string | null;
    tipo: TipoGravamen;
    monto: number | null;
    moneda: string | null;
    autos: string | null;
    juzgado: string | null;
    fecha_inscripcion: string | null;
    estado: EstadoGravamen;
    observaciones: string | null;
    created_at?: string;
    updated_at?: string;
}

export type GravamenInsert = Omit<Gravamen, "id" | "created_at" | "updated_at">;
export type GravamenUpdate = Partial<GravamenInsert> & { id: string };

export async function getGravamenesPorCarpeta(carpetaId: string): Promise<Gravamen[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("gravamenes")
        .select("*")
        .eq("carpeta_id", carpetaId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching gravamenes:", error);
        throw new Error(error.message);
    }

    return (data as Gravamen[]) || [];
}

export async function createGravamen(data: GravamenInsert): Promise<Gravamen> {
    const supabase = await createClient();
    const { data: newGravamen, error } = await supabase
        .from("gravamenes")
        .insert(data)
        .select()
        .single();

    if (error) {
        console.error("Error creating gravamen:", error);
        throw new Error(error.message);
    }

    return newGravamen as Gravamen;
}

export async function updateGravamen(data: GravamenUpdate): Promise<Gravamen> {
    const supabase = await createClient();
    const { id, ...updateData } = data;

    const { data: updatedGravamen, error } = await supabase
        .from("gravamenes")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

    if (error) {
        console.error("Error updating gravamen:", error);
        throw new Error(error.message);
    }

    return updatedGravamen as Gravamen;
}

export async function deleteGravamen(id: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
        .from("gravamenes")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Error deleting gravamen:", error);
        throw new Error(error.message);
    }
}
