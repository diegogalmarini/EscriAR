import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpload() {
    console.log("Creating test record...");
    const { data: registro, error: insertError } = await supabase
        .from('protocolo_registros')
        .insert({ anio: 2026, nro_escritura: 7778, es_errose: false })
        .select()
        .single();

    if (insertError) {
        console.error("Insert Error:", insertError);
        return;
    }
    console.log("Created record ID:", registro.id);

    console.log("Uploading fake PDF...");
    const fakePdfContent = Buffer.from("%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF");
    const blob = new Blob([fakePdfContent], { type: 'application/pdf' });
    const arrayBuffer = await blob.arrayBuffer();

    const fileName = `7778.pdf`;
    const storagePath = `protocolo_2026/${fileName}`;

    console.log("Supabase storage upload...");
    const { error: uploadErr } = await supabase.storage
        .from("protocolo")
        .upload(storagePath, arrayBuffer, {
            contentType: 'application/pdf',
            upsert: true,
        });

    if (uploadErr) {
        console.error("Upload Error:", uploadErr);
        return;
    }
    console.log("Upload OK!");

    console.log("Updating record...");
    const { data: updated, error: updateErr } = await supabase
        .from("protocolo_registros")
        .update({
            pdf_storage_path: storagePath,
            extraction_status: "PENDIENTE",
            extraction_data: null,
            extraction_evidence: null,
            extraction_error: null,
            confirmed_by: null,
            confirmed_at: null,
        })
        .eq("id", registro.id)
        .select()
        .single();
    
    if (updateErr) {
        console.error("Update Error:", updateErr);
        return;
    }
    console.log("Update OK, status:", updated.extraction_status);

    console.log("Inserting job...");
    const { error: jobErr } = await supabase
        .from("ingestion_jobs")
        .insert({
            carpeta_id: null,
            job_type: "ESCRITURA_EXTRACT",
            status: "pending",
            original_filename: "test.pdf",
            file_path: storagePath,
            entity_ref: {
                registro_id: registro.id,
                anio: 2026,
                nro_escritura: 7778,
            },
        });
    
    if (jobErr) {
        console.error("Job Insert Error:", jobErr);
    } else {
        console.log("Job Insert OK");
    }
}

testUpload();
