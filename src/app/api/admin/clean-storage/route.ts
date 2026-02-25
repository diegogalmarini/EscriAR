import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Administrative API endpoint to clean orphaned files from Storage.
 * DELETE /api/admin/clean-storage
 */
export async function DELETE() {
    try {
        // 1. Get all files from the escrituras storage bucket
        const { data: files, error: listError } = await supabaseAdmin.storage
            .from('escrituras')
            .list('documents', {
                limit: 1000,
                sortBy: { column: 'created_at', order: 'desc' }
            });

        if (listError) throw listError;

        if (!files || files.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No files found in storage',
                filesRemoved: 0
            });
        }

        // 2. Get all valid PDF URLs from the database
        const { data: escrituras, error: dbError } = await supabaseAdmin
            .from('escrituras')
            .select('pdf_url')
            .not('pdf_url', 'is', null);

        if (dbError) throw dbError;

        // Extract just the filenames from the URLs
        const validFilenames = new Set(
            (escrituras || [])
                .map((e: any) => {
                    const match = e.pdf_url?.match(/\/documents\/(.+)$/);
                    return match ? match[1] : null;
                })
                .filter((name: any): name is string => !!name)
        );

        // 3. Find orphaned files (exist in storage but not in database)
        const orphanedFiles = files.filter((file: any) => !validFilenames.has(file.name));

        if (orphanedFiles.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No orphaned files found',
                filesRemoved: 0
            });
        }

        // 4. Delete orphaned files
        const filePaths = orphanedFiles.map((f: any) => `documents/${f.name}`);
        const { error: deleteError } = await supabaseAdmin.storage
            .from('escrituras')
            .remove(filePaths);

        if (deleteError) throw deleteError;

        return NextResponse.json({
            success: true,
            message: `Successfully removed ${orphanedFiles.length} orphaned file(s)`,
            filesRemoved: orphanedFiles.length,
            removedFileNames: orphanedFiles.map((f: any) => f.name)
        });

    } catch (error: any) {
        console.error('Error cleaning orphaned storage files:', error);
        return NextResponse.json({
            success: false,
            error: 'Error limpiando archivos de storage.',
            filesRemoved: 0
        }, { status: 500 });
    }
}
