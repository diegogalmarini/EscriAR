"use server";

import { createClient } from "@/lib/supabaseServer";

export interface PendingAlert {
    id: string;
    severity: "critical" | "warning" | "info";
    message: string;
    count: number;
    carpetas: { id: string; label: string }[];
}

export interface PendingSummary {
    total: number;
    alerts: PendingAlert[];
}

export async function getPendingActionsSummary(): Promise<PendingSummary> {
    const supabase = await createClient();
    const alerts: PendingAlert[] = [];

    // 1. Sugerencias PROPOSED sin decidir
    const { data: sugerencias } = await supabase
        .from("sugerencias")
        .select("id, carpeta_id, carpetas(id, caratula, nro_carpeta_interna)")
        .eq("estado", "PROPOSED");

    if (sugerencias && sugerencias.length > 0) {
        const carpetaMap = new Map<string, { id: string; label: string }>();
        for (const s of sugerencias) {
            const c = s.carpetas as any;
            if (c?.id && !carpetaMap.has(c.id)) {
                carpetaMap.set(c.id, {
                    id: c.id,
                    label: c.caratula || `Carpeta #${c.nro_carpeta_interna}`,
                });
            }
        }
        alerts.push({
            id: "sugerencias_pendientes",
            severity: "info",
            message: "Sugerencias pendientes de revisión",
            count: sugerencias.length,
            carpetas: Array.from(carpetaMap.values()),
        });
    }

    // 2. Certificados vencidos
    const { data: certVencidos } = await supabase
        .from("certificados")
        .select("id, carpeta_id, carpetas(id, caratula, nro_carpeta_interna)")
        .eq("estado", "VENCIDO");

    if (certVencidos && certVencidos.length > 0) {
        const carpetaMap = new Map<string, { id: string; label: string }>();
        for (const c of certVencidos) {
            const carp = c.carpetas as any;
            if (carp?.id && !carpetaMap.has(carp.id)) {
                carpetaMap.set(carp.id, {
                    id: carp.id,
                    label: carp.caratula || `Carpeta #${carp.nro_carpeta_interna}`,
                });
            }
        }
        alerts.push({
            id: "cert_vencidos",
            severity: "critical",
            message: "Certificados vencidos",
            count: certVencidos.length,
            carpetas: Array.from(carpetaMap.values()),
        });
    }

    // 3. Certificados por vencer (≤3 días)
    const inThreeDays = new Date();
    inThreeDays.setDate(inThreeDays.getDate() + 3);
    const { data: certPorVencer } = await supabase
        .from("certificados")
        .select("id, carpeta_id, carpetas(id, caratula, nro_carpeta_interna)")
        .eq("estado", "RECIBIDO")
        .lte("fecha_vencimiento", inThreeDays.toISOString().split("T")[0])
        .gte("fecha_vencimiento", new Date().toISOString().split("T")[0]);

    if (certPorVencer && certPorVencer.length > 0) {
        const carpetaMap = new Map<string, { id: string; label: string }>();
        for (const c of certPorVencer) {
            const carp = c.carpetas as any;
            if (carp?.id && !carpetaMap.has(carp.id)) {
                carpetaMap.set(carp.id, {
                    id: carp.id,
                    label: carp.caratula || `Carpeta #${carp.nro_carpeta_interna}`,
                });
            }
        }
        alerts.push({
            id: "cert_por_vencer",
            severity: "warning",
            message: "Certificados por vencer",
            count: certPorVencer.length,
            carpetas: Array.from(carpetaMap.values()),
        });
    }

    // 4. Certificados sin confirmar (extracción completada, no confirmada)
    const { data: certSinConfirmar } = await supabase
        .from("certificados")
        .select("id, carpeta_id, carpetas(id, caratula, nro_carpeta_interna)")
        .eq("extraction_status", "COMPLETADO")
        .is("confirmed_at", null);

    if (certSinConfirmar && certSinConfirmar.length > 0) {
        const carpetaMap = new Map<string, { id: string; label: string }>();
        for (const c of certSinConfirmar) {
            const carp = c.carpetas as any;
            if (carp?.id && !carpetaMap.has(carp.id)) {
                carpetaMap.set(carp.id, {
                    id: carp.id,
                    label: carp.caratula || `Carpeta #${carp.nro_carpeta_interna}`,
                });
            }
        }
        alerts.push({
            id: "cert_sin_confirmar",
            severity: "info",
            message: "Certificados extraídos sin confirmar",
            count: certSinConfirmar.length,
            carpetas: Array.from(carpetaMap.values()),
        });
    }

    // 5. Actuaciones DRAFT pendientes de generar
    const { data: actuacionesDraft } = await supabase
        .from("actuaciones")
        .select("id, carpeta_id, carpetas(id, caratula, nro_carpeta_interna)")
        .eq("status", "DRAFT");

    if (actuacionesDraft && actuacionesDraft.length > 0) {
        const carpetaMap = new Map<string, { id: string; label: string }>();
        for (const a of actuacionesDraft) {
            const carp = a.carpetas as any;
            if (carp?.id && !carpetaMap.has(carp.id)) {
                carpetaMap.set(carp.id, {
                    id: carp.id,
                    label: carp.caratula || `Carpeta #${carp.nro_carpeta_interna}`,
                });
            }
        }
        alerts.push({
            id: "actuaciones_draft",
            severity: "info",
            message: "Actuaciones pendientes de generar",
            count: actuacionesDraft.length,
            carpetas: Array.from(carpetaMap.values()),
        });
    }

    const total = alerts.reduce((sum, a) => sum + a.count, 0);
    return { total, alerts };
}
