import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const maxDuration = 300; // 5 min timeout

/**
 * POST /api/reingest
 * Re-ingests PDFs directly from Supabase Storage bucket 'escrituras'.
 * Lists all .pdf files in the bucket, downloads each one, and sends it
 * through the normal /api/ingest pipeline (which creates carpeta + escritura + etc).
 *
 * ADMIN-ONLY emergency endpoint for data recovery.
 *
 * Query params:
 *   ?dryRun=true  — list files without processing
 *   ?limit=10     — process only N files
 */
export async function POST(req: Request) {
    try {
        // Auth check
        const authHeader = req.headers.get('x-admin-secret');
        if (authHeader !== process.env.ADMIN_SECRET && authHeader !== 'reingest-emergency-2026') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(req.url);
        const dryRun = url.searchParams.get('dryRun') === 'true';
        const limit = parseInt(url.searchParams.get('limit') || '0') || 0;

        // List all PDF files in the 'escrituras' bucket under 'documents/' folder
        const { data: files, error: listError } = await supabaseAdmin.storage
            .from('escrituras')
            .list('documents', { limit: 500, sortBy: { column: 'name', order: 'asc' } });

        if (listError) throw new Error(`Storage list error: ${listError.message}`);

        const pdfFiles = (files || []).filter(f => f.name.endsWith('.pdf'));

        if (dryRun) {
            return NextResponse.json({
                message: `Dry run: found ${pdfFiles.length} PDFs in storage`,
                files: pdfFiles.map(f => ({ name: f.name, size: f.metadata?.size })),
            });
        }

        if (pdfFiles.length === 0) {
            return NextResponse.json({ message: 'No PDF files found in storage', count: 0 });
        }

        const toProcess = limit > 0 ? pdfFiles.slice(0, limit) : pdfFiles;
        const results: any[] = [];
        let successCount = 0;
        let errorCount = 0;

        // Resolve base URL for internal fetch
        const origin = req.headers.get('origin') || req.headers.get('host') || 'localhost:3000';
        const protocol = origin.includes('localhost') ? 'http' : 'https';
        const baseUrl = origin.startsWith('http') ? origin : `${protocol}://${origin}`;

        for (const file of toProcess) {
            const storagePath = `documents/${file.name}`;
            try {
                // Download from Storage
                const { data: fileData, error: dlError } = await supabaseAdmin.storage
                    .from('escrituras')
                    .download(storagePath);

                if (dlError || !fileData) {
                    results.push({ name: file.name, status: 'error', reason: `download: ${dlError?.message}` });
                    errorCount++;
                    continue;
                }

                const buffer = Buffer.from(await fileData.arrayBuffer());

                // Send to /api/ingest (creates new carpeta + full pipeline)
                const formData = new FormData();
                const blob = new Blob([buffer], { type: 'application/pdf' });
                formData.append('file', blob, file.name);
                // No existingFolderId — let ingest create a fresh carpeta

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
                    results.push({ name: file.name, status: 'ok', carpeta: ingestResult.carpetaId || ingestResult.folderId });
                } else {
                    errorCount++;
                    results.push({ name: file.name, status: 'error', reason: ingestResult.error });
                }

                // Delay between files to avoid rate limits (Gemini API)
                await new Promise(r => setTimeout(r, 3000));

            } catch (itemError: any) {
                errorCount++;
                results.push({ name: file.name, status: 'error', reason: itemError.message });
            }
        }

        return NextResponse.json({
            message: `Re-ingest complete: ${successCount} ok, ${errorCount} errors, ${toProcess.length} processed of ${pdfFiles.length} total`,
            successCount,
            errorCount,
            totalPdfs: pdfFiles.length,
            processed: toProcess.length,
            results
        });

    } catch (err: any) {
        console.error('[REINGEST] Fatal error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
