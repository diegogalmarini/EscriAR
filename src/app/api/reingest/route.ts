"use server";
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/reingest
 * Re-ingests all carpetas by downloading their PDFs from Storage
 * and sending them through the normal ingest pipeline.
 *
 * This is an ADMIN-ONLY emergency endpoint for data recovery.
 */
export async function POST(req: Request) {
    try {
        // Auth check - require secret header
        const authHeader = req.headers.get('x-admin-secret');
        if (authHeader !== process.env.ADMIN_SECRET && authHeader !== 'reingest-emergency-2024') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all escrituras with PDF URLs
        const { data: escrituras, error } = await supabaseAdmin
            .from('escrituras')
            .select('id, pdf_url, carpeta_id, numero_escritura')
            .not('pdf_url', 'is', null)
            .order('created_at', { ascending: true });

        if (error) throw error;
        if (!escrituras || escrituras.length === 0) {
            return NextResponse.json({ message: 'No escrituras found with PDFs', count: 0 });
        }

        const results: any[] = [];
        let successCount = 0;
        let errorCount = 0;

        for (const esc of escrituras) {
            try {
                if (!esc.pdf_url || !esc.carpeta_id) {
                    results.push({ id: esc.id, status: 'skipped', reason: 'no pdf_url or carpeta_id' });
                    continue;
                }

                // Extract storage path from public URL
                // URL format: https://xxx.supabase.co/storage/v1/object/public/escrituras/documents/123_file.pdf
                const storagePathMatch = esc.pdf_url.match(/\/escrituras\/(.+)$/);
                if (!storagePathMatch) {
                    results.push({ id: esc.id, status: 'skipped', reason: 'cannot parse storage path' });
                    continue;
                }
                const storagePath = storagePathMatch[1];

                // Download from Storage
                const { data: fileData, error: dlError } = await supabaseAdmin.storage
                    .from('escrituras')
                    .download(storagePath);

                if (dlError || !fileData) {
                    results.push({ id: esc.id, status: 'error', reason: `download failed: ${dlError?.message}` });
                    errorCount++;
                    continue;
                }

                // Convert to File-like object for the ingest pipeline
                const buffer = Buffer.from(await fileData.arrayBuffer());
                const fileName = storagePath.split('/').pop() || 'document.pdf';

                // Call the ingest API internally
                const formData = new FormData();
                const blob = new Blob([buffer], { type: 'application/pdf' });
                formData.append('file', blob, fileName);
                formData.append('existingFolderId', esc.carpeta_id);

                // Make internal request to ingest endpoint
                const origin = req.headers.get('origin') || req.headers.get('host') || 'localhost:3000';
                const protocol = origin.includes('localhost') ? 'http' : 'https';
                const baseUrl = origin.startsWith('http') ? origin : `${protocol}://${origin}`;

                const ingestResponse = await fetch(`${baseUrl}/api/ingest`, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Cookie': req.headers.get('cookie') || '',
                    }
                });

                const ingestResult = await ingestResponse.json();

                if (ingestResult.success || ingestResult.status === 'PROCESSING_BACKGROUND') {
                    successCount++;
                    results.push({ id: esc.id, carpeta: esc.carpeta_id, status: 'ok', fileName });
                } else {
                    errorCount++;
                    results.push({ id: esc.id, carpeta: esc.carpeta_id, status: 'error', reason: ingestResult.error });
                }

                // Small delay to avoid rate limits
                await new Promise(r => setTimeout(r, 2000));

            } catch (itemError: any) {
                errorCount++;
                results.push({ id: esc.id, status: 'error', reason: itemError.message });
            }
        }

        return NextResponse.json({
            message: `Re-ingest complete: ${successCount} ok, ${errorCount} errors, ${escrituras.length} total`,
            successCount,
            errorCount,
            totalEscrituras: escrituras.length,
            results
        });

    } catch (err: any) {
        console.error('[REINGEST] Fatal error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
