"use server";

import { createClient } from "@/lib/supabaseServer";
import { getUserOrgId } from "@/lib/auth/getOrg";

export interface PendingAlert {
    key: string;
    label: string;
    count: number;
    severity: "critical" | "warning" | "info";
    carpetaIds: string[];
}

export interface PendingActionsSummary {
    total: number;
    alerts: PendingAlert[];
}

/**
 * Returns a summary of items that need the notary's attention across all carpetas.
 * Single round-trip, no heavy joins.
 */
export async function getPendingActionsSummary(): Promise<PendingActionsSummary> {
    const orgId = await getUserOrgId();
    if (!orgId) return { total: 0, alerts: [] };

    const supabase = await createClient();
    const alerts: PendingAlert[] = [];
    const now = new Date();
    const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // +3 days

    // 1. Sugerencias pendientes (PROPOSED)
    const { data: sugRows } = await supabase
        .from("sugerencias")
        .select("carpeta_id")
        .eq("estado", "PROPOSED")
        .limit(100);

    if (sugRows && sugRows.length > 0) {
        const uniqueCarpetas = [...new Set(sugRows.map((r) => r.carpeta_id))];
        alerts.push({
            key: "sugerencias_pendientes",
            label: "Sugerencias de IA sin revisar",
            count: sugRows.length,
            severity: "warning",
            carpetaIds: uniqueCarpetas.slice(0, 5),
        });
    }

    // 2. Certificados vencidos
    const { data: vencidos } = await supabase
        .from("certificados")
        .select("carpeta_id, fecha_vencimiento")
        .lt("fecha_vencimiento", now.toISOString().split("T")[0])
        .eq("estado", "RECIBIDO")
        .limit(100);

    if (vencidos && vencidos.length > 0) {
        const uniqueCarpetas = [...new Set(vencidos.map((r) => r.carpeta_id))];
        alerts.push({
            key: "certs_vencidos",
            label: "Certificados vencidos",
            count: vencidos.length,
            severity: "critical",
            carpetaIds: uniqueCarpetas.slice(0, 5),
        });
    }

    // 3. Certificados por vencer (próximos 3 días)
    const { data: porVencer } = await supabase
        .from("certificados")
        .select("carpeta_id, fecha_vencimiento")
        .gte("fecha_vencimiento", now.toISOString().split("T")[0])
        .lte("fecha_vencimiento", soon.toISOString().split("T")[0])
        .eq("estado", "RECIBIDO")
        .limit(100);

    if (porVencer && porVencer.length > 0) {
        const uniqueCarpetas = [...new Set(porVencer.map((r) => r.carpeta_id))];
        alerts.push({
            key: "certs_por_vencer",
            label: "Certificados por vencer (3 días)",
            count: porVencer.length,
            severity: "warning",
            carpetaIds: uniqueCarpetas.slice(0, 5),
        });
    }

    // 4. Certificados sin confirmar extracción
    const { data: sinConfirmar } = await supabase
        .from("certificados")
        .select("carpeta_id")
        .eq("extraction_status", "COMPLETADO")
        .is("confirmed_at", null)
        .limit(100);

    if (sinConfirmar && sinConfirmar.length > 0) {
        const uniqueCarpetas = [...new Set(sinConfirmar.map((r) => r.carpeta_id))];
        alerts.push({
            key: "certs_sin_confirmar",
            label: "Extracciones IA sin confirmar",
            count: sinConfirmar.length,
            severity: "info",
            carpetaIds: uniqueCarpetas.slice(0, 5),
        });
    }

    // 5. Actuaciones en DRAFT sin documento generado
    const { data: drafts } = await supabase
        .from("actuaciones")
        .select("carpeta_id")
        .eq("status", "DRAFT")
        .limit(100);

    if (drafts && drafts.length > 0) {
        const uniqueCarpetas = [...new Set(drafts.map((r) => r.carpeta_id))];
        alerts.push({
            key: "actuaciones_draft",
            label: "Actuaciones pendientes de generar",
            count: drafts.length,
            severity: "info",
            carpetaIds: uniqueCarpetas.slice(0, 5),
        });
    }

    const total = alerts.reduce((sum, a) => sum + a.count, 0);
    return { total, alerts };
}
