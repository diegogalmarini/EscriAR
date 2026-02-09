"use server";

import { createClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import { logAction } from "@/lib/logger";


export async function createPersona(formData: {
    nombre_completo: string;
    dni: string;
    email?: string;
    telefono?: string;
    cuit?: string;
    cuit_tipo?: string;
    cuit_is_formal?: boolean;
}) {
    try {
        const supabase = await createClient();
        // Generate a temporary DNI if not provided
        const finalDni = formData.dni?.trim()
            ? formData.dni.trim()
            : `SIN-DNI-${Date.now()}`;

        const { data, error } = await supabase
            .from("personas")
            .insert([{
                nombre_completo: formData.nombre_completo,
                dni: finalDni,
                cuit: formData.cuit || null,
                cuit_tipo: formData.cuit_tipo || 'CUIT',
                cuit_is_formal: formData.cuit_is_formal ?? true,
                contacto: {
                    email: formData.email,
                    telefono: formData.telefono
                },
                updated_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                throw new Error("Ya existe un cliente con ese DNI.");
            }
            throw error;
        }

        await logAction('CREATE', 'PERSONA', { id: data.dni, dni: data.dni });

        revalidatePath('/clientes');
        return { success: true, data };
    } catch (error: any) {
        console.error("Error creating persona:", error);
        return { success: false, error: error.message };
    }
}

export async function updatePersona(identifier: string, formData: {
    nombre_completo: string;
    nacionalidad?: string;
    fecha_nacimiento?: string;
    estado_civil?: string;
    nombres_padres?: string;
    nombre_conyuge?: string;
    domicilio?: string;
    email?: string;
    telefono?: string;
    dni?: string;
    cuit?: string;
    cuit_tipo?: string;
    cuit_is_formal?: boolean;
}) {
    try {
        const supabase = await createClient();
        const updateData: any = {
            nombre_completo: formData.nombre_completo,
            nacionalidad: formData.nacionalidad || null,
            fecha_nacimiento: formData.fecha_nacimiento || null,
            estado_civil_detalle: formData.estado_civil || null,
            nombres_padres: formData.nombres_padres || null,
            datos_conyuge: formData.nombre_conyuge ? { nombre_completo: formData.nombre_conyuge } : null,
            domicilio_real: formData.domicilio ? { literal: formData.domicilio } : null,
            contacto: {
                email: formData.email || null,
                telefono: formData.telefono || null
            },
            dni: formData.dni || null,
            cuit: formData.cuit || null,
            cuit_tipo: formData.cuit_tipo || 'CUIT',
            cuit_is_formal: formData.cuit_is_formal ?? true,
            updated_at: new Date().toISOString()
        };

        // Try to find persona by ID (UUID) first, then by DNI, then by CUIT
        let query = supabase.from("personas").update(updateData);

        // Check if identifier looks like a UUID (has dashes)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

        if (isUUID) {
            query = query.eq("id", identifier);
        } else if (identifier && !identifier.startsWith('SIN-DNI')) {
            // Try DNI first
            query = query.eq("dni", identifier);
        } else {
            // Fallback to CUIT if DNI is invalid
            query = query.eq("cuit", formData.cuit || identifier);
        }

        const { data, error } = await query.select();

        if (error) throw error;

        if (!data || data.length === 0) {
            throw new Error("No se encontró la persona para actualizar");
        }

        await logAction('UPDATE', 'PERSONA', { id: identifier, dni: formData.dni || identifier });

        revalidatePath('/clientes');
        return { success: true, data: data[0] };
    } catch (error: any) {
        console.error("Error updating persona:", error);
        return { success: false, error: error.message };
    }
}

export async function deletePersona(dni: string) {
    try {
        const supabase = await createClient();
        const { error } = await supabase
            .from("personas")
            .delete()
            .eq("dni", dni);

        if (error) throw error;

        await logAction('DELETE', 'PERSONA', { id: dni, dni: dni });

        revalidatePath('/clientes');
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting persona:", error);
        return { success: false, error: error.message };
    }
}
