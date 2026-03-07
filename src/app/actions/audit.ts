"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireOrgMembership } from "@/lib/auth/getOrg";

export interface AuditEventRow {
    id: string;
    created_at: string;
    actor_email: string | null;
    action: string;
    summary: string;
}

/**
 * Returns recent audit events for a carpeta (newest first).
 */
export async function getAuditEventsForCarpeta(
    carpetaId: string,
    limit = 20
): Promise<AuditEventRow[]> {
    const { orgId } = await requireOrgMembership();

    const { data, error } = await supabaseAdmin
        .from("audit_events")
        .select("id, created_at, actor_email, action, summary")
        .eq("carpeta_id", carpetaId)
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) {
        console.error("[getAuditEventsForCarpeta] Error:", error.message);
        return [];
    }

    return (data as AuditEventRow[]) || [];
}
