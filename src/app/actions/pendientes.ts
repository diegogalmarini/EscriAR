"use server";

import { createClient } from "@/lib/supabaseServer";
import { generarCaratula } from "@/lib/caratula";

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

/** Nested select para obtener la jerarquía completa y generar carátula dinámica */
const CARPETA_LABEL_SELECT = `id, caratula, nro_carpeta_interna, ingesta_estado, escrituras(source, operaciones(tipo_acto, participantes_operacion(rol, persona:personas(nombre_completo))))`;

function buildLabel(carpeta: any): string {
    const { titulo } = generarCaratula(carpeta);
    return titulo;
}

function collectCarpetas(rows: any[], carpetaField: string = "carpetas"): { id: string; label: string }[] {
    const map = new Map<string, { id: string; label: string }>();
    for (const row of rows) {
        const c = row[carpetaField] as any;
        if (c?.id && !map.has(c.id)) {
            map.set(c.id, { id: c.id, label: buildLabel(c) });
        }
    }
    return Array.from(map.values());
}

export async function getPendingActionsSummary(): Promise<PendingSummary> {
    const supabase = await createClient();
    const alerts: PendingAlert[] = [];

    // 1. Sugerencias PROPOSED sin decidir
    const { data: sugerencias } = await supabase
        .from("sugerencias")
        .select(`id, carpeta_id, carpetas(${CARPETA_LABEL_SELECT})`)
        .eq("estado", "PROPOSED");

    if (sugerencias && sugerencias.length > 0) {
        alerts.push({
            id: "sugerencias_pendientes",
            severity: "info",
            message: "Sugerencias pendientes de revisión",
            count: sugerencias.length,
            carpetas: collectCarpetas(sugerencias),
        });
    }

    // 2. Certificados vencidos
    const { data: certVencidos } = await supabase
        .from("certificados")
        .select(`id, carpeta_id, carpetas(${CARPETA_LABEL_SELECT})`)
        .eq("estado", "VENCIDO");

    if (certVencidos && certVencidos.length > 0) {
        alerts.push({
            id: "cert_vencidos",
            severity: "critical",
            message: "Certificados vencidos",
            count: certVencidos.length,
            carpetas: collectCarpetas(certVencidos),
        });
    }

    // 3. Certificados por vencer (≤3 días)
    const inThreeDays = new Date();
    inThreeDays.setDate(inThreeDays.getDate() + 3);
    const { data: certPorVencer } = await supabase
        .from("certificados")
        .select(`id, carpeta_id, carpetas(${CARPETA_LABEL_SELECT})`)
        .eq("estado", "RECIBIDO")
        .lte("fecha_vencimiento", inThreeDays.toISOString().split("T")[0])
        .gte("fecha_vencimiento", new Date().toISOString().split("T")[0]);

    if (certPorVencer && certPorVencer.length > 0) {
        alerts.push({
            id: "cert_por_vencer",
            severity: "warning",
            message: "Certificados por vencer",
            count: certPorVencer.length,
            carpetas: collectCarpetas(certPorVencer),
        });
    }

    // 4. Certificados sin confirmar (extracción completada, no confirmada)
    const { data: certSinConfirmar } = await supabase
        .from("certificados")
        .select(`id, carpeta_id, carpetas(${CARPETA_LABEL_SELECT})`)
        .eq("extraction_status", "COMPLETADO")
        .is("confirmed_at", null);

    if (certSinConfirmar && certSinConfirmar.length > 0) {
        alerts.push({
            id: "cert_sin_confirmar",
            severity: "info",
            message: "Certificados extraídos sin confirmar",
            count: certSinConfirmar.length,
            carpetas: collectCarpetas(certSinConfirmar),
        });
    }

    // 5. Actuaciones DRAFT pendientes de generar
    const { data: actuacionesDraft } = await supabase
        .from("actuaciones")
        .select(`id, carpeta_id, carpetas(${CARPETA_LABEL_SELECT})`)
        .eq("status", "DRAFT");

    if (actuacionesDraft && actuacionesDraft.length > 0) {
        alerts.push({
            id: "actuaciones_draft",
            severity: "info",
            message: "Actuaciones pendientes de generar",
            count: actuacionesDraft.length,
            carpetas: collectCarpetas(actuacionesDraft),
        });
    }

    const total = alerts.reduce((sum, a) => sum + a.count, 0);
    return { total, alerts };
}
