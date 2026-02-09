"use server";

import { createClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";

export async function getFichaByToken(tokenId: string) {
    try {
        const supabase = await createClient();
        const { data: tokenData, error: tokenError } = await supabase
            .from("fichas_web_tokens")
            .select("*, personas(*)")
            .eq("id", tokenId)
            .single();

        if (tokenError) throw tokenError;

        // Check if expired
        if (new Date(tokenData.expires_at) < new Date()) {
            return { success: false, error: "El link ha expirado." };
        }

        if (tokenData.estado === 'COMPLETADO') {
            return { success: true, alreadyCompleted: true, data: tokenData };
        }

        return { success: true, data: tokenData };
    } catch (error: any) {
        console.error("Error fetching ficha:", error);
        return { success: false, error: "Token inválido o no encontrado." };
    }
}

export async function submitFichaData(tokenId: string, oldDni: string, formData: any) {
    try {
        const supabase = await createClient();
        // 1. Update Persona (DNI is PK, but ON UPDATE CASCADE handles references)
        const { error: pError } = await supabase
            .from("personas")
            .update({
                nombre_completo: formData.nombre_completo,
                dni: formData.dni, // New DNI from the form
                cuit: formData.cuit,
                nacionalidad: formData.nacionalidad,
                fecha_nacimiento: formData.fecha_nacimiento,
                domicilio_real: { literal: formData.domicilio },
                nombres_padres: formData.nombres_padres,
                estado_civil_detalle: formData.estado_civil,
                datos_conyuge: formData.nombre_conyuge ? { nombre_completo: formData.nombre_conyuge } : null,
                contacto: {
                    email: formData.email,
                    telefono: formData.telefono
                },
                updated_at: new Date().toISOString()
            })
            .eq("dni", oldDni);

        if (pError) throw pError;

        // 2. Mark Token as Completed
        const { error: tError } = await supabase
            .from("fichas_web_tokens")
            .update({ estado: 'COMPLETADO' })
            .eq("id", tokenId);

        if (tError) throw tError;

        revalidatePath('/clientes');
        return { success: true };
    } catch (error: any) {
        console.error("Error submitting ficha:", error);

        // Handle specific database errors
        if (error.code === '23505') {
            return { success: false, error: "Este DNI ya está registrado en el sistema." };
        }

        return { success: false, error: error.message };
    }
}

export async function generateFichaLink(personaId: string) {
    try {
        const supabase = await createClient();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        const { data, error } = await supabase
            .from("fichas_web_tokens")
            .insert([{
                persona_id: personaId,
                estado: 'PENDIENTE',
                expires_at: expiresAt.toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        // Use the current host from headers for total reliability
        let baseUrl = 'https://noti-ar.vercel.app';

        try {
            const { headers } = await import('next/headers');
            const headersList = await headers();
            const host = headersList.get('host');
            if (host) {
                const protocol = host.includes('localhost') ? 'http' : 'https';
                baseUrl = `${protocol}://${host}`;
            }
        } catch (e) {
            // Fallback used only if headers fail
            console.warn("Could not get host from headers, using fallback:", baseUrl);
        }

        const link = `${baseUrl}/ficha/${data.id}`;

        return { success: true, link };
    } catch (error: any) {
        console.error("Error generating link:", error);
        return { success: false, error: error.message };
    }
}
