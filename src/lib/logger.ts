import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@/lib/supabaseServer";

/**
 * Log an action to the audit_logs table
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
