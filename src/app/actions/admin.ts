"use server";

import { createClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { revalidatePath } from "next/cache";
import { logAction } from "@/lib/logger";

const SUPER_ADMIN_EMAIL = "diegogalmarini@gmail.com";

/**
 * Verify if the current user is a super admin
 */
async function isAdmin(): Promise<boolean> {
    try {
        const supabase = await createClient();
        const userRes = await supabase.auth.getUser();
        const user = userRes.data?.user;

        if (!user) {
            // Fallback to session for performance or if getUser is too strict
            const sessionRes = await supabase.auth.getSession();
            const session = sessionRes.data?.session;
            if (!session?.user) return false;

            if (session.user.email === SUPER_ADMIN_EMAIL) return true;

            const { data: profile } = await supabase
                .from("user_profiles")
                .select("role")
                .eq("id", session.user.id)
                .single();
            return profile?.role === "admin";
        }

        if (user.email === SUPER_ADMIN_EMAIL) return true;

        const { data: profile } = await supabase
            .from("user_profiles")
            .select("role")
            .eq("id", user.id)
            .single();

        return profile?.role === "admin";
    } catch (err) {
        console.error("[isAdmin] Check failed:", err);
        return false;
    }
}

/**
 * Get all users with their approval status
 */
export async function getAllUsers() {
    try {
        if (!(await isAdmin())) {
            return { success: false, error: "Unauthorized", data: [] };
        }

        const { data, error } = await supabaseAdmin
            .from("admin_user_list")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("[getAllUsers] DB Error:", error);
            throw error;
        }

        return { success: true, data: data || [] };
    } catch (error: any) {
        console.error("[getAllUsers] Exception:", error);
        return { success: false, error: error.message || "Internal Server Error", data: [] };
    }
}

/**
 * Approve a user
 */
export async function approveUser(userId: string) {
    try {
        if (!(await isAdmin())) {
            return { success: false, error: "Unauthorized" };
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        const { error } = await supabaseAdmin
            .from("user_profiles")
            .update({
                approval_status: "approved",
                approved_by: user?.id,
                approved_at: new Date().toISOString(),
            })
            .eq("id", userId);

        if (error) throw error;

        // Log action
        await logAction('APPROVE_USER', 'USER_PROFILE', { userId });

        revalidatePath("/admin/users");
        return { success: true };
    } catch (error: any) {
        console.error("Error approving user:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Reject a user
 */
export async function rejectUser(userId: string) {
    try {
        if (!(await isAdmin())) {
            return { success: false, error: "Unauthorized" };
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        const { error } = await supabaseAdmin
            .from("user_profiles")
            .update({
                approval_status: "rejected",
                approved_by: user?.id,
                approved_at: new Date().toISOString(),
            })
            .eq("id", userId);

        if (error) throw error;

        revalidatePath("/admin/users");
        return { success: true };
    } catch (error: any) {
        console.error("Error rejecting user:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete a user (removes from auth.users and user_profiles via CASCADE)
 */
export async function deleteUser(userId: string) {
    try {
        if (!(await isAdmin())) {
            return { success: false, error: "Unauthorized" };
        }

        // Delete from user_profiles (auth.users will cascade delete via trigger)
        const { error } = await supabaseAdmin
            .from("user_profiles")
            .delete()
            .eq("id", userId);

        if (error) throw error;

        revalidatePath("/admin/users");
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting user:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Get user statistics
 */
export async function getUserStats() {
    try {
        if (!(await isAdmin())) {
            return { success: false, error: "Unauthorized", data: null };
        }

        const { data, error } = await supabaseAdmin
            .from("admin_user_list")
            .select("approval_status");

        if (error) {
            console.error("[getUserStats] DB Error:", error);
            throw error;
        }

        const stats = {
            total: data.length,
            pending: data.filter((u: any) => u.approval_status === "pending").length,
            approved: data.filter((u: any) => u.approval_status === "approved").length,
            rejected: data.filter((u: any) => u.approval_status === "rejected").length,
        };

        return { success: true, data: stats };
    } catch (error: any) {
        console.error("[getUserStats] Exception:", error);
        return { success: false, error: error.message || "Internal Server Error", data: null };
    }
}

/**
 * Pre-create a user (Invitation)
 */
export async function preCreateUser(email: string, fullName: string) {
    try {
        if (!(await isAdmin())) {
            return { success: false, error: "Unauthorized" };
        }

        const supabase = await createClient();
        // We insert into user_profiles directly. 
        // When the user signs up with this email, the trigger/logic will match it.
        // OR we just set them as approved so when they join, they are already in.
        const { error } = await supabaseAdmin
            .from("user_profiles")
            .insert([{
                email,
                full_name: fullName,
                approval_status: 'approved',
                role: 'user'
            }]);

        if (error) throw error;

        await logAction('INVITE_USER', 'USER_PROFILE', { email, fullName });

        revalidatePath("/admin/users");
        return { success: true };
    } catch (error: any) {
        console.error("Error pre-creating user:", error);
        return { success: false, error: error.message };
    }
}
