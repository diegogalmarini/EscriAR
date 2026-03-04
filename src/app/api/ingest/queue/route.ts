import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getOrgIdForUser } from '@/lib/auth/getOrg';

export async function POST(req: Request) {
    try {
        const asyncCookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return asyncCookieStore.get(name)?.value;
                    },
                },
            }
        );

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { filePath, fileName, fileSize, mimeType, carpetaId } = body;

        if (!filePath || !fileName) {
            return NextResponse.json({ error: "Faltan datos del archivo" }, { status: 400 });
        }

        let folderId: string;

        if (carpetaId) {
            // Use existing carpeta — just update its ingestion status
            const { error: updateError } = await supabaseAdmin.from('carpetas').update({
                ingesta_estado: 'PROCESANDO',
                ingesta_paso: 'En cola',
            }).eq('id', carpetaId);

            if (updateError) throw new Error(`Error actualizando carpeta: ${updateError.message}`);
            folderId = carpetaId;
        } else {
            // Create new folder for this ingestion
            const orgId = await getOrgIdForUser(user.id);
            const { data: carpeta, error: folderError } = await supabaseAdmin.from('carpetas').insert({
                caratula: fileName.substring(0, 100),
                ingesta_estado: 'PROCESANDO',
                ingesta_paso: 'En cola',
                org_id: orgId
            }).select().single();

            if (folderError) throw new Error(`Error creando carpeta: ${folderError.message}`);
            folderId = carpeta.id;
        }

        // Insert the job
        const { data: job, error: jobError } = await supabaseAdmin.from('ingestion_jobs').insert({
            user_id: user.id,
            carpeta_id: folderId,
            file_path: filePath,
            original_filename: fileName,
            file_size_bytes: fileSize,
            mime_type: mimeType || 'application/pdf',
            status: 'pending'
        }).select().single();

        if (jobError) throw new Error(`Error creando trabajo de ingesta: ${jobError.message}`);

        return NextResponse.json({
            success: true,
            jobId: job.id,
            folderId,
            message: "Encolado para procesamiento"
        });

    } catch (error: any) {
        console.error("Queue API Error:", error);
        return NextResponse.json({ error: 'Error al encolar el trabajo de ingesta.' }, { status: 500 });
    }
}
