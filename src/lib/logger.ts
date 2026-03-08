import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@/lib/supabaseServer";

// ── Tipos de acciones auditables ──
export type AuditAction =
    | "FOLDER_CREATED"
    | "FOLDER_DELETED"
    | "FOLDER_STATE_CHANGED"
    | "NOTE_CREATED"
    | "NOTE_DELETED"
    | "SUGGESTION_ACCEPTED"
    | "SUGGESTION_REJECTED"
    | "CERT_UPLOADED"
    | "CERT_CONFIRMED"
    | "CERT_DELETED"
    | "ACTUACION_GENERATED"
    | "ACTUACION_DELETED"
    | "DOC_RENDERED"
    | "ESCRITURA_UPLOADED"
    | "ESCRITURA_EXTRACTION_CONFIRMED"
    | "PARTICIPANT_ADDED"
    | "PARTICIPANT_REMOVED"
    | "INMUEBLE_LINKED"
    | "PROTOCOLO_REGISTRO_CREATED"
    | "PROTOCOLO_REGISTRO_DELETED"
    | "PROTOCOLO_CREATED_FROM_CARPETA"
    | "PROTOCOLO_UPDATED_FROM_CARPETA";

export interface AuditEventInput {
    action: AuditAction;
    entityType: string;       // carpeta, apunte, certificado, actuacion, etc.
    entityId?: string | null;
    carpetaId?: string | null;
    summary: string;          // línea legible: "Creó apunte en carpeta #12"
    metadata?: Record<string, any>;
    result?: "OK" | "ERROR";
}

/**
 * Log an audit event. Fire-and-forget: never throws.
 * Uses supabaseAdmin to bypass RLS.
 */
export async function logAuditEvent(input: AuditEventInput) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get org_id
        const { data: membership } = await supabase
            .from("organizaciones_users")
            .select("org_id")
            .eq("user_id", user.id)
            .limit(1)
            .single();

        if (!membership?.org_id) return;

        await supabaseAdmin.from("audit_events").insert({
            org_id: membership.org_id,
            actor_id: user.id,
            actor_email: user.email || null,
            action: input.action,
            entity_type: input.entityType,
            entity_id: input.entityId || null,
            carpeta_id: input.carpetaId || null,
            summary: input.summary,
            metadata: input.metadata || {},
            result: input.result || "OK",
        });
    } catch (err) {
        // Fire-and-forget: never break the calling action
        console.error("[logAuditEvent] Error:", err);
    }
}

/**
 * @deprecated Use logAuditEvent instead
 */
export async function logAction(action: string, entity: string, details: any = {}) {
    try {
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();

        const { error } = await supabaseAdmin
            .from("audit_logs")
            .insert([{
                user_id: session?.user?.id,
                action,
                entity,
                details
            }]);

        if (error) {
            console.error("[logAction] Error:", error.message);
        }
    } catch (err) {
        console.error("[logAction] Exception:", err);
    }
}
