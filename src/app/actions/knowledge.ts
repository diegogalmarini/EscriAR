"use server";

import { indexDocument, KnowledgeCategory } from "@/lib/knowledge";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { revalidatePath } from "next/cache";

// Note: maxDuration cannot be exported from a "use server" file in this Next.js version as it triggers Turbopack errors.

/**
 * Retrieves a summarized list of unique files indexed in the Knowledge Base
 */
export async function getKnowledgeFiles() {
    try {
        const { data, error } = await supabaseAdmin
            .from('knowledge_base')
            .select('metadata, created_at');

        if (error) throw error;

        // Grouping logic to show unique documents
        const docsMap = new Map<string, any>();

        data.forEach((item: any) => {
            const meta = item.metadata as any;
            const fileName = meta.source_file;

            if (!docsMap.has(fileName)) {
                docsMap.set(fileName, {
                    name: fileName,
                    category: meta.category || 'LAW',
                    indexedAt: meta.indexed_at || item.created_at,
                    chunks: 0
                });
            }
            const doc = docsMap.get(fileName);
            doc.chunks++;
        });

        const sortedDocs = Array.from(docsMap.values()).sort((a, b) =>
            new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime()
        );

        return { success: true, data: sortedDocs };
    } catch (error: any) {
        console.error('[KNOWLEDGE_ACTION] Error fetching files:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Handles Web-based file upload and indexing
 */
export async function uploadKnowledgeFile(formData: FormData) {
    try {
        const file = formData.get('file') as File;
        const category = formData.get('category') as KnowledgeCategory;

        if (!file) throw new Error("Debe seleccionar un archivo");
        if (!category) throw new Error("Debe seleccionar una categoría");

        console.log(`[KNOWLEDGE_ACTION] Uploading ${file.name} to ${category}...`);

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const result = await indexDocument(buffer, file.name, category);

        revalidatePath('/admin/users');
        return { success: true, chunks: result.chunks };
    } catch (error: any) {
        console.error('[KNOWLEDGE_ACTION] Upload error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Deletes all chunks associated with a specific file
 */
export async function deleteKnowledgeFile(fileName: string) {
    try {
        console.log(`[KNOWLEDGE_ACTION] Deleting ${fileName}...`);

        // Supabase doesn't support nested metadata filtering with @> in simple delete builders easily
        // We use a safe approach by specifying the exact metadata object we expect
        const { error } = await supabaseAdmin
            .from('knowledge_base')
            .delete()
            .filter('metadata->>source_file', 'eq', fileName);

        if (error) throw error;

        revalidatePath('/admin/users');
        return { success: true };
    } catch (error: any) {
        console.error('[KNOWLEDGE_ACTION] Delete error:', error);
        return { success: false, error: error.message };
    }
}
