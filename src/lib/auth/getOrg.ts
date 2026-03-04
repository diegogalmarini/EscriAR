"use server";

import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ID fijo de la organización por defecto (Escribanía Galmarini)
const DEFAULT_ORG_ID = "a0000000-0000-0000-0000-000000000001";

/**
 * Obtiene el org_id del usuario autenticado (para Server Actions).
 * Retorna el primer org_id al que pertenece.
 * Retorna null si no pertenece a ninguna org.
 */
export async function getUserOrgId(): Promise<string | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
        .from("organizaciones_users")
        .select("org_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

    return data?.org_id || null;
}

/**
 * Obtiene el org_id para un user_id dado (para API routes que usan supabaseAdmin).
 * Si no encuentra membresía, retorna la org por defecto.
 */
export async function getOrgIdForUser(userId: string): Promise<string> {
    const { data } = await supabaseAdmin
        .from("organizaciones_users")
        .select("org_id")
        .eq("user_id", userId)
        .limit(1)
        .single();

    return data?.org_id || DEFAULT_ORG_ID;
}

/**
 * Verifica que el usuario autenticado pertenece a al menos una organización.
 * Para usar en Server Components/Actions que necesiten protección.
 */
export async function requireOrgMembership(): Promise<{ orgId: string; userId: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const { data } = await supabase
        .from("organizaciones_users")
        .select("org_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

    if (!data?.org_id) throw new Error("Sin acceso a organización");

    return { orgId: data.org_id, userId: user.id };
}
