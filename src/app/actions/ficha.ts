"use server";

import { createClient } from "@/lib/supabaseServer";
import { randomUUID } from "node:crypto";

export async function createFichaToken(personaId: string) {
    try {
        const supabase = await createClient();
        // Generate a random token
        const token = randomUUID();

        // Expiration: 7 days from now
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const { data, error } = await supabase
            .from("fichas_web_tokens")
            .insert([{
                id: token,
                persona_id: personaId,
                estado: "PENDIENTE",
                expires_at: expiresAt.toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        // Build the full URL dynamically or fallback to production
        let baseUrl = "https://escriar.vercel.app";
        try {
            const { headers } = await import("next/headers");
            const headersList = await headers();
            const host = headersList.get("host");
            if (host) {
                const protocol = host.includes("localhost") ? "http" : "https";
                baseUrl = `${protocol}://${host}`;
            }
        } catch (e) {
            console.warn("Using fallback URL for ficha token");
        }
        const url = `${baseUrl}/ficha/${token}`;

        return { success: true, url };
    } catch (error: any) {
        console.error("Error creating ficha token:", error);
        return { success: false, error: error.message };
    }
}
