"use server";

import { createClient } from "@/lib/supabaseServer";
import { requireOrgMembership } from "@/lib/auth/getOrg";
import { logAuditEvent } from "@/lib/logger";

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
export type ExtractionStatus = "PENDIENTE" | "PROCESANDO" | "COMPLETADO" | "ERROR";

export interface ExtractionData {
    titular?: string | null;
    inscripcion?: string | null;
    fecha_emision?: string | null;
    fecha_vencimiento?: string | null;
    numero_certificado?: string | null;
    organismo?: string | null;
    gravamenes?: string[] | null;
    inhibiciones?: string[] | null;
    estado_deuda?: string | null;
    monto_adeudado?: number | null;
    nomenclatura?: string | null;
    superficie?: string | null;
    valuacion_fiscal?: number | null;
    observaciones_ia?: string | null;
    datos_adicionales?: Record<string, unknown> | null;
}

export interface ExtractionEvidence {
    fragmentos: { campo: string; texto: string; confianza: "HIGH" | "MED" | "LOW" }[];
}

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
    storage_path: string | null;
    extraction_status: ExtractionStatus | null;
    extraction_data: ExtractionData | null;
    extraction_evidence: ExtractionEvidence | null;
    extraction_error: string | null;
    confirmed_by: string | null;
    confirmed_at: string | null;
    created_at?: string;
    updated_at?: string;
}

export type CertificadoInsert = Omit<Certificado, "id" | "created_at" | "updated_at" | "extraction_status" | "extraction_data" | "extraction_evidence" | "extraction_error" | "confirmed_by" | "confirmed_at">;
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

    logAuditEvent({
        action: "CERT_UPLOADED",
        entityType: "certificado",
        entityId: result.id,
        carpetaId: data.carpeta_id,
        summary: `Agregó certificado ${data.tipo}`,
        metadata: { tipo: data.tipo },
    });

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

    // Get carpeta_id before deleting
    const { data: cert } = await supabase
        .from("certificados")
        .select("carpeta_id, tipo")
        .eq("id", id)
        .single();

    const { error } = await supabase
        .from("certificados")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Error deleting certificado:", error);
        throw new Error(error.message);
    }

    logAuditEvent({
        action: "CERT_DELETED",
        entityType: "certificado",
        entityId: id,
        carpetaId: cert?.carpeta_id || null,
        summary: `Eliminó certificado${cert?.tipo ? ` ${cert.tipo}` : ""}`,
    });
}

/**
 * Sube un PDF de certificado a Storage y dispara el job CERT_EXTRACT.
 * Retorna el certificado actualizado con storage_path y extraction_status.
 */
export async function uploadCertificadoPdf(certificadoId: string, formData: FormData): Promise<Certificado> {
    const { orgId, userId } = await requireOrgMembership();
    const supabase = await createClient();

    const file = formData.get("file") as File;
    if (!file || file.size === 0) throw new Error("No se recibió archivo");
    if (file.size > 10 * 1024 * 1024) throw new Error("El archivo supera 10MB");

    const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(file.type)) throw new Error("Tipo de archivo no permitido. Solo PDF e imágenes.");

    // Verificar que el certificado pertenece a la org
    const { data: cert, error: fetchErr } = await supabase
        .from("certificados")
        .select("id, carpeta_id")
        .eq("id", certificadoId)
        .single();
    if (fetchErr || !cert) throw new Error("Certificado no encontrado");

    // Upload a Storage
    const ext = file.name.split(".").pop() || "pdf";
    const storagePath = `${orgId}/${cert.carpeta_id}/${certificadoId}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadErr } = await supabase.storage
        .from("certificados")
        .upload(storagePath, arrayBuffer, {
            contentType: file.type,
            upsert: true,
        });
    if (uploadErr) throw new Error(`Error subiendo archivo: ${uploadErr.message}`);

    // Actualizar certificado con storage_path y marcar extracción pendiente
    const { data: updated, error: updateErr } = await supabase
        .from("certificados")
        .update({
            storage_path: storagePath,
            extraction_status: "PENDIENTE",
            extraction_data: null,
            extraction_evidence: null,
            extraction_error: null,
            confirmed_by: null,
            confirmed_at: null,
        })
        .eq("id", certificadoId)
        .select()
        .single();
    if (updateErr) throw new Error(updateErr.message);

    // Crear job CERT_EXTRACT
    const { error: jobErr } = await supabase
        .from("ingestion_jobs")
        .insert({
            carpeta_id: cert.carpeta_id,
            job_type: "CERT_EXTRACT",
            status: "pending",
            original_filename: file.name,
            file_path: storagePath,
            entity_ref: { certificado_id: certificadoId, tipo: updated.tipo },
        });
    if (jobErr) {
        console.error("Error creando job CERT_EXTRACT:", jobErr);
        // No bloqueante: el certificado se subió correctamente
    }

    return updated as Certificado;
}

/**
 * Confirma la extracción IA de un certificado.
 * El usuario puede corregir campos antes de confirmar.
 * Solo datos confirmados impactan fecha_vencimiento/estado.
 */
export async function confirmCertificadoExtraction(
    certificadoId: string,
    confirmedData: Partial<{
        fecha_vencimiento: string | null;
        nro_certificado: string | null;
        organismo: string | null;
        observaciones: string | null;
        estado: EstadoCertificado;
    }>
): Promise<Certificado> {
    const { userId } = await requireOrgMembership();
    const supabase = await createClient();

    const updatePayload: Record<string, unknown> = {
        confirmed_by: userId,
        confirmed_at: new Date().toISOString(),
    };

    // Aplicar campos confirmados/corregidos
    if (confirmedData.fecha_vencimiento !== undefined) updatePayload.fecha_vencimiento = confirmedData.fecha_vencimiento;
    if (confirmedData.nro_certificado !== undefined) updatePayload.nro_certificado = confirmedData.nro_certificado;
    if (confirmedData.organismo !== undefined) updatePayload.organismo = confirmedData.organismo;
    if (confirmedData.observaciones !== undefined) updatePayload.observaciones = confirmedData.observaciones;
    if (confirmedData.estado !== undefined) updatePayload.estado = confirmedData.estado;

    const { data, error } = await supabase
        .from("certificados")
        .update(updatePayload)
        .eq("id", certificadoId)
        .select()
        .single();

    if (error) throw new Error(error.message);

    logAuditEvent({
        action: "CERT_CONFIRMED",
        entityType: "certificado",
        entityId: certificadoId,
        carpetaId: (data as any).carpeta_id || null,
        summary: `Confirmó extracción de certificado`,
    });

    return data as Certificado;
}

/**
 * Reintentar la extracción IA de un certificado.
 */
export async function retryCertExtraction(certificadoId: string): Promise<void> {
    const { orgId } = await requireOrgMembership();
    const supabase = await createClient();

    const { data: cert, error: fetchErr } = await supabase
        .from("certificados")
        .select("id, carpeta_id, storage_path, tipo")
        .eq("id", certificadoId)
        .single();
    if (fetchErr || !cert) throw new Error("Certificado no encontrado");
    if (!cert.storage_path) throw new Error("Sin archivo para reanalizar");

    // Reset extraction status
    await supabase.from("certificados").update({
        extraction_status: "PENDIENTE",
        extraction_data: null,
        extraction_evidence: null,
        extraction_error: null,
        confirmed_by: null,
        confirmed_at: null,
    }).eq("id", certificadoId);

    // Crear nuevo job
    const { error: jobErr } = await supabase
        .from("ingestion_jobs")
        .insert({
            carpeta_id: cert.carpeta_id,
            job_type: "CERT_EXTRACT",
            status: "pending",
            original_filename: cert.storage_path.split("/").pop(),
            file_path: cert.storage_path,
            entity_ref: { certificado_id: certificadoId, tipo: cert.tipo },
        });
    if (jobErr) throw new Error(`Error creando job: ${jobErr.message}`);
}

/**
 * Obtiene URL firmada para un certificado en Storage.
 */
export async function getCertificadoSignedUrl(storagePath: string): Promise<string> {
    await requireOrgMembership();
    const supabase = await createClient();

    const { data, error } = await supabase.storage
        .from("certificados")
        .createSignedUrl(storagePath, 3600); // 1 hora

    if (error) throw new Error(error.message);
    return data.signedUrl;
}
