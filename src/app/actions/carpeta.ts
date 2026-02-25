"use server";

import { createClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import { logAction } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function createFolder(caratula?: string) {
    try {
        const supabase = await createClient();
        // 1. Crear la Carpeta
        const { data: carpeta, error: carpetaError } = await supabase
            .from('carpetas')
            .insert([{ caratula, estado: 'ABIERTA' }])
            .select()
            .single();

        if (carpetaError) throw carpetaError;

        // 2. Crear una Escritura Borrador automáticamente (Simplificación solicitada)
        const { data: escritura, error: escrituraError } = await supabase
            .from('escrituras')
            .insert([{ carpeta_id: carpeta.id }])
            .select()
            .single();

        if (escrituraError) throw escrituraError;

        // 3. Crear una Operación Borrador automáticamente (Simplificación solicitada)
        const { data: operacion, error: operacionError } = await supabase
            .from('operaciones')
            .insert([{ escritura_id: escritura.id, tipo_acto: 'COMPRAVENTA' }])
            .select()
            .single();

        if (operacionError) throw operacionError;

        revalidatePath('/dashboard');
        return { success: true, carpetaId: carpeta.id };
    } catch (error: any) {
        console.error('Error creating folder hierarchy:', error);
        return { success: false, error: error.message };
    }
}

export async function addOperationToDeed(escrituraId: string, tipoActo: string, monto?: number) {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('operaciones')
            .insert([{ escritura_id: escrituraId, tipo_acto: tipoActo, monto_operacion: monto }])
            .select()
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function linkPersonToOperation(operacionId: string, personaId: string, rol: string, porcentaje?: number) {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('participantes_operacion')
            .insert([{
                operacion_id: operacionId,
                persona_id: personaId,
                rol,
                porcentaje_titularidad: porcentaje
            }])
            .select()
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function removePersonFromOperation(operacionId: string, personaId: string) {
    try {
        const supabase = await createClient();
        const { error } = await supabase
            .from('participantes_operacion')
            .delete()
            .eq('operacion_id', operacionId)
            .eq('persona_id', personaId);

        if (error) throw error;
        revalidatePath('/carpeta');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateRepresentacion(
    participanteId: string,
    datos: { representa_a?: string; caracter?: string; poder_detalle?: string }
) {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('participantes_operacion')
            .update({
                datos_representacion: {
                    representa_a: datos.representa_a || null,
                    caracter: datos.caracter || null,
                    poder_detalle: datos.poder_detalle || null
                }
            })
            .eq('id', participanteId)
            .select()
            .single();

        if (error) throw error;

        revalidatePath('/carpeta/[id]', 'page');
        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function linkAssetToDeed(escrituraId: string, inmuebleId: string) {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('escrituras')
            .update({ inmueble_princ_id: inmuebleId })
            .eq('id', escrituraId)
            .select()
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateFolderStatus(folderId: string, newStatus: string) {
    try {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('carpetas')
            .update({ estado: newStatus })
            .eq('id', folderId)
            .select()
            .single();

        if (error) throw error;
        revalidatePath('/dashboard');
        revalidatePath(`/carpeta/${folderId}`);
        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteCarpeta(carpetaId: string) {
    try {
        const supabase = await createClient();

        // 1. Get folder details and all associated escrituras with PDF URLs
        const { data: folder } = await supabase
            .from('carpetas')
            .select('caratula, escrituras(pdf_url)')
            .eq('id', carpetaId)
            .single();

        // 2. Delete all PDF files from Storage
        if (folder?.escrituras && Array.isArray(folder.escrituras)) {
            const pdfUrls = folder.escrituras
                .map((e: any) => e.pdf_url)
                .filter((url): url is string => !!url);

            if (pdfUrls.length > 0) {
                // Extract clean file paths from URLs (ignoring query params/tokens)
                const filePaths = pdfUrls.map((url: any) => {
                    try {
                        const parts = url.split('/escrituras/');
                        if (parts.length < 2) return null;

                        // The relative path is in parts[1], but we must strip query params
                        const pathWithQuery = parts[1];
                        return pathWithQuery.split('?')[0].split('#')[0].split('%3F')[0];
                    } catch (e: any) {
                        return null;
                    }
                }).filter((path: any): path is string => !!path);

                if (filePaths.length > 0) {
                    console.log(`[STORAGE] Attempting to delete ${filePaths.length} files:`, filePaths);
                    // Use supabaseAdmin to bypass any RLS storage restrictions
                    const { error: storageError } = await supabaseAdmin.storage
                        .from('escrituras')
                        .remove(filePaths);

                    if (storageError) {
                        console.error('[STORAGE] Error deleting files:', storageError);
                    }
                }
            }
        }

        // 3. Perform database deletion
        // We rely on Supabase CASCADE for escrituras -> operaciones -> participantes
        const { error } = await supabase
            .from('carpetas')
            .delete()
            .eq('id', carpetaId);

        if (error) throw error;

        // 4. Log action
        await logAction('DELETE', 'CARPETA', {
            id: carpetaId,
            caratula: folder?.caratula
        });

        revalidatePath('/dashboard');
        revalidatePath('/carpetas');
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting folder:', error);
        return { success: false, error: error.message };
    }
}

export async function unlinkPersonFromOperation(participanteId: string) {
    try {
        const supabase = await createClient();
        const { error } = await supabase
            .from('participantes_operacion')
            .delete()
            .eq('id', participanteId);

        if (error) throw error;

        revalidatePath('/dashboard');
        // We'll also try to revalidate the current page if possible, 
        // though revalidatePath works by route pattern too.
        revalidatePath('/carpeta/[id]', 'page');

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function upsertPerson(data: any) {
    try {
        const supabase = await createClient();
        // Generate temporary DNI if not provided (same as createPersona)
        const finalDni = data.dni?.toString().trim()
            ? data.dni.toString().trim()
            : `SIN-DNI-${Date.now()}`;

        const { data: persona, error } = await supabase
            .from('personas')
            .upsert({
                ...data,
                dni: finalDni,
                updated_at: new Date().toISOString()
            }, { onConflict: 'dni' })
            .select()
            .single();

        if (error) throw error;
        return { success: true, data: persona };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
