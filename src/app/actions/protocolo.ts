"use server";

import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireOrgMembership } from "@/lib/auth/getOrg";
import { logAuditEvent } from "@/lib/logger";

// ── Types ──

export type ExtractionStatus = "PENDIENTE" | "PROCESANDO" | "COMPLETADO" | "ERROR";

export interface EscrituraExtractionData {
    nro_escritura?: number | null;
    fecha?: string | null;              // "2026-02-15"
    folios?: string | null;             // "001/005"
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
    const { orgId, userId } = await requireOrgMembership();
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

    // Create ESCRITURA_EXTRACT job (use admin client — RLS on ingestion_jobs
    // requires carpeta_id, but protocolo registros have no carpeta)
    const { error: jobErr } = await supabaseAdmin
        .from("ingestion_jobs")
        .insert({
            user_id: userId,
            carpeta_id: null,
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
    const { userId } = await requireOrgMembership();
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

    // Create new job (use admin — RLS requires carpeta_id, protocolo has none)
    const { error: jobErr } = await supabaseAdmin
        .from("ingestion_jobs")
        .insert({
            user_id: userId,
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

// ── Publish Carpeta → Protocolo (ET7.1) ──

const ROLES_TRANSMITENTE = ["VENDEDOR", "TRANSMITENTE", "DONANTE", "CEDENTE", "FIDUCIANTE", "TITULAR", "CONDOMINO"];
const ROLES_ADQUIRENTE = ["COMPRADOR", "ADQUIRENTE", "DONATARIO", "CESIONARIO", "MUTUARIO", "FIDEICOMISARIO"];

/**
 * Crea o actualiza un registro de protocolo a partir de los datos de una carpeta.
 * Idempotente: si ya existe un registro con ese carpeta_id, lo actualiza.
 * Se dispara automáticamente cuando la carpeta pasa a FIRMADA, o manualmente.
 */
export async function publishToProtocolo(
    carpetaId: string
): Promise<{ success: boolean; registroId?: string; isUpdate?: boolean; error?: string }> {
    try {
        await requireOrgMembership();

        // Load carpeta with full hierarchy (admin bypasses RLS, same as page loader)
        const { data: carpeta, error: loadErr } = await supabaseAdmin
            .from("carpetas")
            .select(`
                *,
                escrituras (
                    *,
                    operaciones (
                        *,
                        participantes_operacion (
                            *,
                            persona:personas (*)
                        )
                    )
                )
            `)
            .eq("id", carpetaId)
            .single();

        if (loadErr || !carpeta) {
            return { success: false, error: "Carpeta no encontrada" };
        }

        // Fuente de verdad: escritura TRAMITE
        const escritura = (carpeta as any).escrituras?.find((e: any) => e.source === "TRAMITE")
            || (carpeta as any).escrituras?.[0];
        if (!escritura) {
            return { success: false, error: "No se encontró escritura para publicar" };
        }

        const operacion = escritura.operaciones?.[0];
        const participantes = operacion?.participantes_operacion || [];

        const vendedores = participantes
            .filter((p: any) => ROLES_TRANSMITENTE.includes(p.rol?.toUpperCase()))
            .map((p: any) => p.persona?.nombre_completo)
            .filter(Boolean);

        const compradores = participantes
            .filter((p: any) => ROLES_ADQUIRENTE.includes(p.rol?.toUpperCase()))
            .map((p: any) => p.persona?.nombre_completo)
            .filter(Boolean);

        // Parse fecha_escritura → dia/mes/anio
        let dia: number | null = null;
        let mes: number | null = null;
        let anio = new Date().getFullYear();

        if (escritura.fecha_escritura) {
            const d = new Date(escritura.fecha_escritura + "T12:00:00");
            if (!isNaN(d.getTime())) {
                dia = d.getDate();
                mes = d.getMonth() + 1;
                anio = d.getFullYear();
            }
        }

        const registroData = {
            nro_escritura: escritura.nro_protocolo ?? null,
            folios: null as string | null,
            dia,
            mes,
            anio,
            tipo_acto: operacion?.tipo_acto || null,
            codigo_acto: operacion?.codigo || null,
            es_errose: false,
            vendedor_acreedor: vendedores.join("; ") || null,
            comprador_deudor: compradores.join("; ") || null,
            monto_ars: operacion?.monto_operacion ?? null,
            monto_usd: null as number | null,
            notas: null as string | null,
            carpeta_id: carpetaId,
        };

        // Upsert: buscar registro existente con este carpeta_id
        const supabase = await createClient();
        const { data: existing } = await supabase
            .from("protocolo_registros")
            .select("id")
            .eq("carpeta_id", carpetaId)
            .maybeSingle();

        let registroId: string;
        const isUpdate = !!existing;

        if (existing) {
            const { data: updated, error: updateErr } = await supabase
                .from("protocolo_registros")
                .update(registroData)
                .eq("id", existing.id)
                .select("id")
                .single();
            if (updateErr) throw updateErr;
            registroId = updated.id;
        } else {
            const { data: created, error: insertErr } = await supabase
                .from("protocolo_registros")
                .insert(registroData)
                .select("id")
                .single();
            if (insertErr) throw insertErr;
            registroId = created.id;
        }

        logAuditEvent({
            action: isUpdate ? "PROTOCOLO_UPDATED_FROM_CARPETA" : "PROTOCOLO_CREATED_FROM_CARPETA",
            entityType: "protocolo_registro",
            entityId: registroId,
            carpetaId,
            summary: `${isUpdate ? "Actualizó" : "Publicó"} registro protocolo desde carpeta`,
            metadata: { nro_escritura: registroData.nro_escritura, tipo_acto: registroData.tipo_acto },
        });

        return { success: true, registroId, isUpdate };
    } catch (error: any) {
        console.error("[publishToProtocolo]", error);
        return { success: false, error: error.message };
    }
}
