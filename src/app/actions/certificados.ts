"use server";

import { createClient } from "@/lib/supabaseServer";

export type TipoCertificado =
    | "DOMINIO"
    | "INHIBICION"
    | "CATASTRAL"
    | "DEUDA_MUNICIPAL"
    | "DEUDA_ARBA"
    | "RENTAS"
    | "AFIP"
    | "ANOTACIONES_PERSONALES"
    | "OTRO";

export type EstadoCertificado = "PENDIENTE" | "SOLICITADO" | "RECIBIDO" | "VENCIDO";

export interface Certificado {
    id: string;
    carpeta_id: string;
    tipo: TipoCertificado;
    estado: EstadoCertificado;
    fecha_solicitud: string | null;
    fecha_recepcion: string | null;
    fecha_vencimiento: string | null;
    nro_certificado: string | null;
    organismo: string | null;
    observaciones: string | null;
    pdf_url: string | null;
    created_at?: string;
    updated_at?: string;
}

export type CertificadoInsert = Omit<Certificado, "id" | "created_at" | "updated_at">;
export type CertificadoUpdate = Partial<CertificadoInsert> & { id: string };

/**
 * Obtiene todos los certificados vinculados a una carpeta.
 */
export async function getCertificadosPorCarpeta(carpetaId: string): Promise<Certificado[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("certificados")
        .select("*")
        .eq("carpeta_id", carpetaId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching certificados:", error);
        throw new Error(error.message);
    }

    return (data as Certificado[]) || [];
}

/**
 * Agrega un nuevo certificado a la base de datos.
 */
export async function createCertificado(data: CertificadoInsert): Promise<Certificado> {
    const supabase = await createClient();
    const { data: result, error } = await supabase
        .from("certificados")
        .insert(data)
        .select()
        .single();

    if (error) {
        console.error("Error creating certificado:", error);
        throw new Error(error.message);
    }

    return result as Certificado;
}

/**
 * Actualiza un certificado existente.
 */
export async function updateCertificado({ id, ...data }: CertificadoUpdate): Promise<Certificado> {
    const supabase = await createClient();
    const { data: result, error } = await supabase
        .from("certificados")
        .update(data)
        .eq("id", id)
        .select()
        .single();

    if (error) {
        console.error("Error updating certificado:", error);
        throw new Error(error.message);
    }

    return result as Certificado;
}

/**
 * Elimina un certificado de la base de datos.
 */
export async function deleteCertificado(id: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
        .from("certificados")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Error deleting certificado:", error);
        throw new Error(error.message);
    }
}
