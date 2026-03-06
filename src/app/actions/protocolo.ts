"use server";

import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireOrgMembership } from "@/lib/auth/getOrg";

// ── Types ──

export type ExtractionStatus = "PENDIENTE" | "PROCESANDO" | "COMPLETADO" | "ERROR";

export interface EscrituraExtractionData {
    nro_escritura?: number | null;
    fecha?: string | null;              // "2026-02-15"
    tipo_acto?: string | null;
    vendedor_acreedor?: string | null;
    comprador_deudor?: string | null;
    codigo_acto?: string | null;
    monto_ars?: number | null;
    monto_usd?: number | null;
    inmueble_descripcion?: string | null;
    observaciones_ia?: string | null;
}

export interface ExtractionEvidence {
    fragmentos: { campo: string; texto: string; confianza: "HIGH" | "MED" | "LOW" }[];
}

export interface ProtocoloRegistro {
    id: string;
    escribania_id: string | null;
    nro_escritura: number | null;
    folios: string | null;
    dia: number | null;
    mes: number | null;
    anio: number;
    tipo_acto: string | null;
    es_errose: boolean;
    vendedor_acreedor: string | null;
    comprador_deudor: string | null;
    monto_usd: number | null;
    monto_ars: number | null;
    codigo_acto: string | null;
    notas: string | null;
    pdf_storage_path: string | null;
    carpeta_id: string | null;
    extraction_status: ExtractionStatus | null;
    extraction_data: EscrituraExtractionData | null;
    extraction_evidence: ExtractionEvidence | null;
    extraction_error: string | null;
    confirmed_by: string | null;
    confirmed_at: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface ProtocoloRegistroInsert {
    nro_escritura: number | null;
    folios: string | null;
    dia: number | null;
    mes: number | null;
    anio: number;
    tipo_acto: string | null;
    es_errose: boolean;
    vendedor_acreedor: string | null;
    comprador_deudor: string | null;
    monto_usd?: number | null;
    monto_ars?: number | null;
    codigo_acto: string | null;
    notas: string | null;
}

// ── CRUD ──

export async function createProtocoloRegistro(data: ProtocoloRegistroInsert): Promise<ProtocoloRegistro> {
    const supabase = await createClient();
    const { data: result, error } = await supabase
        .from("protocolo_registros")
        .insert(data)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return result as ProtocoloRegistro;
}

export async function updateProtocoloRegistro(
    id: string,
    data: Partial<ProtocoloRegistroInsert>
): Promise<ProtocoloRegistro> {
    const supabase = await createClient();
    const { data: result, error } = await supabase
        .from("protocolo_registros")
        .update(data)
        .eq("id", id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return result as ProtocoloRegistro;
}

export async function deleteProtocoloRegistro(id: string): Promise<void> {
    const supabase = await createClient();

    // Get record first to check for PDF
    const { data: row } = await supabase
        .from("protocolo_registros")
        .select("pdf_storage_path")
        .eq("id", id)
        .single();

    // Delete PDF from storage if exists
    if (row?.pdf_storage_path) {
        await supabaseAdmin.storage.from("protocolo").remove([row.pdf_storage_path]);
    }

    const { error } = await supabase
        .from("protocolo_registros")
        .delete()
        .eq("id", id);

    if (error) throw new Error(error.message);
}

export async function getProtocoloRegistro(id: string): Promise<ProtocoloRegistro> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("protocolo_registros")
        .select("*")
        .eq("id", id)
        .single();

    if (error) throw new Error(error.message);
    return data as ProtocoloRegistro;
}

// ── PDF Upload + AI Extraction ──

export async function uploadEscrituraPdf(
    registroId: string,
    formData: FormData
): Promise<ProtocoloRegistro> {
    const { orgId } = await requireOrgMembership();
    const supabase = await createClient();

    const file = formData.get("file") as File;
    if (!file || file.size === 0) throw new Error("No se recibió archivo");
    if (file.size > 10 * 1024 * 1024) throw new Error("El archivo supera 10MB");

    const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
        throw new Error("Tipo de archivo no permitido. Solo PDF e imágenes.");
    }

    // Get the registro
    const { data: registro, error: fetchErr } = await supabase
        .from("protocolo_registros")
        .select("id, anio, nro_escritura")
        .eq("id", registroId)
        .single();
    if (fetchErr || !registro) throw new Error("Registro no encontrado");

    // Upload to Storage: protocolo_2026/NRO.pdf (or registroId for errose)
    const ext = file.name.split(".").pop() || "pdf";
    const fileName = registro.nro_escritura
        ? `${registro.nro_escritura}.${ext}`
        : `${registroId}.${ext}`;
    const storagePath = `protocolo_${registro.anio}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadErr } = await supabaseAdmin.storage
        .from("protocolo")
        .upload(storagePath, arrayBuffer, {
            contentType: file.type,
            upsert: true,
        });
    if (uploadErr) throw new Error(`Error subiendo archivo: ${uploadErr.message}`);

    // Update registro with storage path and mark extraction pending
    const { data: updated, error: updateErr } = await supabase
        .from("protocolo_registros")
        .update({
            pdf_storage_path: storagePath,
            extraction_status: "PENDIENTE",
            extraction_data: null,
            extraction_evidence: null,
            extraction_error: null,
            confirmed_by: null,
            confirmed_at: null,
        })
        .eq("id", registroId)
        .select()
        .single();
    if (updateErr) throw new Error(updateErr.message);

    // Create ESCRITURA_EXTRACT job
    const { error: jobErr } = await supabase
        .from("ingestion_jobs")
        .insert({
            carpeta_id: null, // Protocolo registros may not have a carpeta
            job_type: "ESCRITURA_EXTRACT",
            status: "pending",
            original_filename: file.name,
            file_path: storagePath,
            entity_ref: {
                registro_id: registroId,
                anio: registro.anio,
                nro_escritura: registro.nro_escritura,
            },
        });
    if (jobErr) {
        console.error("Error creando job ESCRITURA_EXTRACT:", jobErr);
    }

    return updated as ProtocoloRegistro;
}

// ── Confirm Extraction (human-in-the-loop) ──

export async function confirmEscrituraExtraction(
    registroId: string,
    corrections: Partial<{
        nro_escritura: number | null;
        dia: number | null;
        mes: number | null;
        tipo_acto: string | null;
        vendedor_acreedor: string | null;
        comprador_deudor: string | null;
        codigo_acto: string | null;
        notas: string | null;
    }>
): Promise<ProtocoloRegistro> {
    const { userId } = await requireOrgMembership();
    const supabase = await createClient();

    const updatePayload: Record<string, unknown> = {
        confirmed_by: userId,
        confirmed_at: new Date().toISOString(),
    };

    // Apply confirmed/corrected fields
    for (const [key, value] of Object.entries(corrections)) {
        if (value !== undefined) updatePayload[key] = value;
    }

    const { data, error } = await supabase
        .from("protocolo_registros")
        .update(updatePayload)
        .eq("id", registroId)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data as ProtocoloRegistro;
}

// ── Retry Extraction ──

export async function retryEscrituraExtraction(registroId: string): Promise<ProtocoloRegistro> {
    await requireOrgMembership();
    const supabase = await createClient();

    // Get current registro
    const { data: registro, error: fetchErr } = await supabase
        .from("protocolo_registros")
        .select("*")
        .eq("id", registroId)
        .single();
    if (fetchErr || !registro) throw new Error("Registro no encontrado");
    if (!registro.pdf_storage_path) throw new Error("No hay PDF cargado");

    // Reset extraction fields
    const { data: updated, error: updateErr } = await supabase
        .from("protocolo_registros")
        .update({
            extraction_status: "PENDIENTE",
            extraction_data: null,
            extraction_evidence: null,
            extraction_error: null,
            confirmed_by: null,
            confirmed_at: null,
        })
        .eq("id", registroId)
        .select()
        .single();
    if (updateErr) throw new Error(updateErr.message);

    // Create new job
    const { error: jobErr } = await supabase
        .from("ingestion_jobs")
        .insert({
            carpeta_id: null,
            job_type: "ESCRITURA_EXTRACT",
            status: "pending",
            original_filename: registro.pdf_storage_path.split("/").pop(),
            file_path: registro.pdf_storage_path,
            entity_ref: {
                registro_id: registroId,
                anio: registro.anio,
                nro_escritura: registro.nro_escritura,
            },
        });
    if (jobErr) {
        console.error("Error creando job retry:", jobErr);
    }

    return updated as ProtocoloRegistro;
}
