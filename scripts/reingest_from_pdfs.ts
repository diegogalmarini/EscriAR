/**
 * Re-ingest masivo desde PDFs locales (protocolo_2026_pdfs/)
 *
 * Lee los PDFs del directorio local y los envía al endpoint /api/ingest
 * del servidor Next.js corriendo en localhost.
 *
 * Prerequisitos:
 *   1. Haber ejecutado migración 061 (TRUNCATE de tablas de datos)
 *   2. Tener el dev server corriendo: npm run dev
 *
 * Uso:
 *   npx tsx scripts/reingest_from_pdfs.ts
 *   npx tsx scripts/reingest_from_pdfs.ts [desde] [hasta]   # rango por nombre de archivo
 */

import * as fs from 'fs';
import * as path from 'path';

const PDF_DIR = path.resolve(__dirname, '../protocolo_2026_pdfs');
const BASE_URL = process.env.INGEST_URL || 'http://localhost:3000';
const DELAY_MS = parseInt(process.env.DELAY_MS || '5000', 10);

interface IngestResult {
    success: boolean;
    status?: string;
    folderId?: string;
    error?: string;
    extractedData?: {
        personas?: any[];
        inmuebles?: any[];
        resumen_acto?: string;
    };
}

async function ingestPdf(filePath: string): Promise<IngestResult> {
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);

    // Create a FormData with the file
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    formData.append('file', blob, fileName);

    const response = await fetch(`${BASE_URL}/api/ingest`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${text.substring(0, 200)}` };
    }

    return await response.json();
}

async function main() {
    const args = process.argv.slice(2);
    const desde = args[0] ? parseInt(args[0]) : null;
    const hasta = args[1] ? parseInt(args[1]) : null;

    // Read and sort PDFs numerically
    if (!fs.existsSync(PDF_DIR)) {
        console.error(`❌ Directorio no encontrado: ${PDF_DIR}`);
        process.exit(1);
    }

    let pdfs = fs.readdirSync(PDF_DIR)
        .filter(f => f.toLowerCase().endsWith('.pdf'))
        .sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, '')) || 0;
            const numB = parseInt(b.replace(/\D/g, '')) || 0;
            return numA - numB;
        });

    // Filter by range if specified
    if (desde !== null || hasta !== null) {
        pdfs = pdfs.filter(f => {
            const num = parseInt(f.replace(/\D/g, '')) || 0;
            if (desde !== null && num < desde) return false;
            if (hasta !== null && num > hasta) return false;
            return true;
        });
    }

    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  RE-INGEST MASIVO — Protocolo 2026 desde PDFs   ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log();
    console.log(`📁 Directorio: ${PDF_DIR}`);
    console.log(`🌐 Servidor: ${BASE_URL}`);
    console.log(`📄 PDFs encontrados: ${pdfs.length}`);
    if (desde || hasta) console.log(`📋 Rango: ${desde || 1} - ${hasta || '∞'}`);
    console.log(`⏱  Delay entre archivos: ${DELAY_MS}ms`);
    console.log();

    // Verify server is running
    try {
        const health = await fetch(`${BASE_URL}/api/ingest`, { method: 'HEAD' }).catch(() => null);
        if (!health) {
            console.error('❌ No se puede conectar al servidor. ¿Está corriendo `npm run dev`?');
            process.exit(1);
        }
    } catch {
        // HEAD might not be supported, continue anyway
    }

    let ok = 0, failed = 0, background = 0;
    const errors: string[] = [];
    const startTime = Date.now();

    for (let i = 0; i < pdfs.length; i++) {
        const pdfName = pdfs[i];
        const pdfPath = path.join(PDF_DIR, pdfName);
        const fileSize = fs.statSync(pdfPath).size;
        const num = pdfName.replace(/\D/g, '');

        console.log(`\n${'─'.repeat(55)}`);
        console.log(`[${i + 1}/${pdfs.length}] 📄 ${pdfName} (${(fileSize / 1024).toFixed(0)} KB)`);

        try {
            const result = await ingestPdf(pdfPath);

            if (result.success) {
                const personas = result.extractedData?.personas?.length || '?';
                const inmuebles = result.extractedData?.inmuebles?.length || 0;
                const resumen = result.extractedData?.resumen_acto || '';

                if (result.status === 'PROCESSING_BACKGROUND') {
                    background++;
                    console.log(`   ⏳ BACKGROUND → Carpeta: ${result.folderId?.substring(0, 8)}...`);
                    console.log(`   (archivo grande, procesando en segundo plano)`);
                } else {
                    ok++;
                    console.log(`   ✅ OK → ${personas} personas, ${inmuebles} inmuebles`);
                    if (resumen) console.log(`   📝 ${resumen.substring(0, 80)}`);
                }
                console.log(`   📂 Carpeta: ${result.folderId?.substring(0, 8)}...`);
            } else {
                failed++;
                const errMsg = result.error || 'Error desconocido';
                errors.push(`${pdfName}: ${errMsg}`);
                console.log(`   ❌ ERROR: ${errMsg.substring(0, 120)}`);
            }
        } catch (err: any) {
            failed++;
            const errMsg = err.message || String(err);
            errors.push(`${pdfName}: ${errMsg}`);
            console.log(`   ❌ EXCEPTION: ${errMsg.substring(0, 120)}`);
        }

        // Delay between files (skip after last)
        if (i < pdfs.length - 1) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
            console.log(`   ⏸ Pausa ${DELAY_MS / 1000}s... (${elapsed}s transcurridos)`);
            await new Promise(r => setTimeout(r, DELAY_MS));
        }
    }

    // Summary
    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`\n${'═'.repeat(55)}`);
    console.log('RESUMEN DE RE-INGEST');
    console.log(`${'═'.repeat(55)}`);
    console.log(`  ✅ Completados (sync):  ${ok}`);
    console.log(`  ⏳ En background:       ${background}`);
    console.log(`  ❌ Fallidos:            ${failed}`);
    console.log(`  📄 Total procesados:    ${pdfs.length}`);
    console.log(`  ⏱  Tiempo total:        ${totalTime} min`);

    if (errors.length > 0) {
        console.log(`\n❌ Errores:`);
        errors.forEach(e => console.log(`   • ${e}`));
    }

    if (background > 0) {
        console.log(`\n⚠️  ${background} archivos grandes están procesándose en background.`);
        console.log('   Verificar en /carpetas que todas terminen con estado COMPLETADO.');
    }

    console.log(`\n✅ Verificación sugerida:`);
    console.log(`   /clientes    → ~50+ personas con datos completos`);
    console.log(`   /inmuebles   → inmuebles con carpeta y documento vinculado`);
    console.log(`   /protocolo   → índice con ~${pdfs.length} escrituras`);
    console.log(`${'═'.repeat(55)}`);
}

main().catch(err => {
    console.error('💥 Error fatal:', err);
    process.exit(1);
});
